import {
  fetchPendingSubmissions, approveSubmission, rejectSubmission,
  fetchGroups, updateGroup, deleteGroup,
  fetchAdmins, removeAdmin,
  fetchApprovedInstitutes, fetchPendingInstitutes,
  approveInstitute, rejectInstitute,
  fetchPendingClaims, approveClaim, rejectClaim
} from './db.js';
import { getCurrentUser, createAdminUser } from './auth.js';
import { loadGroups, loadPublicInstitutes } from './ui-groups.js';
import { loadInstituteOptions } from './ui-form.js';

// DOM refs
const pendingList = document.getElementById('pending-list');
const pendingLoading = document.getElementById('pending-loading');
const pendingEmpty = document.getElementById('pending-empty');
const manageList = document.getElementById('manage-list');
const manageLoading = document.getElementById('manage-loading');
const manageEmpty = document.getElementById('manage-empty');
const adminsList = document.getElementById('admins-list');

// Submission review modal (now editable)
const modalSubmission = document.getElementById('modal-submission');
const reviewName = document.getElementById('review-name');
const reviewKeywords = document.getElementById('review-keywords');
const reviewSummary = document.getElementById('review-summary');
const reviewLinksContainer = document.getElementById('review-links-container');
const btnReviewAddLink = document.getElementById('btn-review-add-link');
const reviewPhotoURL = document.getElementById('review-photo-url');
const reviewMeta = document.getElementById('review-meta');
const btnApprove = document.getElementById('btn-approve');
const btnReject = document.getElementById('btn-reject');
const reviewSubfield = document.getElementById('review-subfield');
const reviewInstituteDisplay = document.getElementById('review-institute-display');
const reviewInstituteWarning = document.getElementById('review-institute-warning');

// Edit modal
const modalEdit = document.getElementById('modal-edit');
const editForm = document.getElementById('edit-form');
const editId = document.getElementById('edit-id');
const editName = document.getElementById('edit-name');
const editKeywords = document.getElementById('edit-keywords');
const editSummary = document.getElementById('edit-summary');
const editLinksContainer = document.getElementById('edit-links-container');
const btnEditAddLink = document.getElementById('btn-edit-add-link');
const editPhotoURL = document.getElementById('edit-photo-url');
const editPhotoCurrentDiv = document.getElementById('edit-photo-current');
const editPhotoImg = document.getElementById('edit-photo-img');
const editMessage = document.getElementById('edit-message');
const editSubfield = document.getElementById('edit-subfield');
const editInstituteDisplay = document.getElementById('edit-institute-display');

// Add admin
const newAdminEmail = document.getElementById('new-admin-email');
const newAdminPassword = document.getElementById('new-admin-password');
const btnAddAdmin = document.getElementById('btn-add-admin');
const adminAddMessage = document.getElementById('admin-add-message');

// Claims tab
const claimsList = document.getElementById('claims-list');
const claimsEmpty = document.getElementById('claims-empty');

// Institutes tab
const institutesPendingList = document.getElementById('institutes-pending-list');
const institutesPendingEmpty = document.getElementById('institutes-pending-empty');
const institutesApprovedList = document.getElementById('institutes-approved-list');
const institutesApprovedEmpty = document.getElementById('institutes-approved-empty');

let currentSubmission = null;

// Cache for institute status lookups
let approvedInstituteNames = new Set();

// ========== TABS ==========

export function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      // Update tabs
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      // Update panels
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(target).classList.add('active');
    });
  });
}

// ========== PENDING SUBMISSIONS ==========

export async function loadPending() {
  pendingLoading.classList.remove('hidden');
  pendingEmpty.classList.add('hidden');
  pendingList.innerHTML = '';

  try {
    const submissions = await fetchPendingSubmissions();
    pendingLoading.classList.add('hidden');

    if (submissions.length === 0) {
      pendingEmpty.classList.remove('hidden');
      return;
    }

    submissions.forEach(sub => {
      const item = document.createElement('div');
      item.className = 'admin-item';
      item.innerHTML = `
        <div class="admin-item-info">
          <div class="admin-item-name">${escapeHTML(sub.name)}</div>
          <div class="admin-item-meta">${(sub.keywords || []).join(', ')}</div>
        </div>
        <div class="admin-item-actions">
          <button class="btn btn-primary btn-sm btn-review" aria-label="Review ${escapeHTML(sub.name)}">Review</button>
        </div>
      `;

      item.querySelector('.btn-review').addEventListener('click', () => showSubmissionDetail(sub));
      pendingList.appendChild(item);
    });
  } catch (err) {
    console.error('Error loading submissions:', err);
    pendingLoading.classList.add('hidden');
  }
}

async function showSubmissionDetail(sub) {
  currentSubmission = sub;

  // Refresh approved institutes cache
  try {
    const approved = await fetchApprovedInstitutes();
    approvedInstituteNames = new Set(approved.map(i => i.name));
  } catch (err) {
    console.error('Error fetching approved institutes:', err);
  }

  // Populate editable fields
  reviewName.value = sub.name || '';
  reviewKeywords.value = (sub.keywords || []).join(', ');
  reviewSummary.value = sub.summary || '';
  reviewPhotoURL.value = sub.photoURL || '';

  // Subfield
  reviewSubfield.value = sub.subfield || 'computational';

  // Institute display + warning
  const instName = sub.institute || '';
  reviewInstituteDisplay.textContent = instName || '(none)';
  const isPending = instName && !approvedInstituteNames.has(instName);
  if (isPending) {
    reviewInstituteWarning.classList.remove('hidden');
    btnApprove.disabled = true;
    btnApprove.title = 'Institute must be approved first';
  } else {
    reviewInstituteWarning.classList.add('hidden');
    btnApprove.disabled = false;
    btnApprove.title = '';
  }

  // Populate links
  reviewLinksContainer.innerHTML = '';
  const links = sub.links || [];
  if (links.length === 0) {
    addReviewLinkRow();
  } else {
    links.forEach(l => addReviewLinkRow(l.label, l.url));
  }

  // Read-only metadata
  const metaParts = [];
  if (sub.submitterEmail) metaParts.push(`<p><strong>Submitter:</strong> ${escapeHTML(sub.submitterEmail)}</p>`);
  if (sub.submitterNote) metaParts.push(`<p><strong>Note:</strong> ${escapeHTML(sub.submitterNote)}</p>`);
  if (sub.creatorUid) metaParts.push(`<p><strong>Creator UID:</strong> ${escapeHTML(sub.creatorUid)}</p>`);
  reviewMeta.innerHTML = metaParts.join('');

  modalSubmission.classList.remove('hidden');
}

function addReviewLinkRow(label = '', url = '') {
  const row = document.createElement('div');
  row.className = 'link-row';
  row.innerHTML = `
    <input type="text" name="link-label" placeholder="Label" value="${escapeHTML(label)}">
    <input type="url" name="link-url" placeholder="https://..." value="${escapeHTML(url)}">
  `;
  reviewLinksContainer.appendChild(row);
}

function getReviewFormData() {
  const name = reviewName.value.trim();
  const keywords = reviewKeywords.value.split(',').map(k => k.trim()).filter(Boolean);
  const summary = reviewSummary.value.trim();
  const photoURL = reviewPhotoURL.value.trim();
  const subfield = reviewSubfield.value;

  const linkRows = reviewLinksContainer.querySelectorAll('.link-row');
  const links = [];
  linkRows.forEach(row => {
    const l = row.querySelector('[name="link-label"]').value.trim();
    const u = row.querySelector('[name="link-url"]').value.trim();
    if (l && u) links.push({ label: l, url: u });
  });

  // Institute comes from original submission (read-only in review)
  const institute = currentSubmission?.institute || '';

  return { name, keywords, summary, links, photoURL, subfield, institute };
}

export function initSubmissionActions() {
  btnReviewAddLink.addEventListener('click', () => addReviewLinkRow());

  btnApprove.addEventListener('click', async () => {
    if (!currentSubmission) return;
    btnApprove.disabled = true;
    try {
      const user = getCurrentUser();
      const overrideData = getReviewFormData();
      await approveSubmission(currentSubmission.id, user.uid, overrideData);
      modalSubmission.classList.add('hidden');
      await loadPending();
      await loadGroups();
    } catch (err) {
      console.error('Approve error:', err);
      alert('Error approving submission.');
    } finally {
      btnApprove.disabled = false;
    }
  });

  btnReject.addEventListener('click', async () => {
    if (!currentSubmission) return;
    btnReject.disabled = true;
    try {
      const user = getCurrentUser();
      await rejectSubmission(currentSubmission.id, user.uid);
      modalSubmission.classList.add('hidden');
      await loadPending();
    } catch (err) {
      console.error('Reject error:', err);
      alert('Error rejecting submission.');
    } finally {
      btnReject.disabled = false;
    }
  });
}

// ========== MANAGE GROUPS ==========

export async function loadManageGroups() {
  manageLoading.classList.remove('hidden');
  manageEmpty.classList.add('hidden');
  manageList.innerHTML = '';

  try {
    const groups = await fetchGroups();
    manageLoading.classList.add('hidden');

    if (groups.length === 0) {
      manageEmpty.classList.remove('hidden');
      return;
    }

    groups.forEach(g => {
      const item = document.createElement('div');
      item.className = 'admin-item';
      const subfieldLabel = g.subfield ? ` [${g.subfield}]` : '';
      const claimedLabel = g.claimedBy ? ' (claimed)' : '';
      item.innerHTML = `
        <div class="admin-item-info">
          <div class="admin-item-name">${escapeHTML(g.name)}${escapeHTML(subfieldLabel)}${claimedLabel}</div>
          <div class="admin-item-meta">${(g.keywords || []).join(', ')}</div>
        </div>
        <div class="admin-item-actions">
          <button class="btn btn-primary btn-sm btn-edit" aria-label="Edit ${escapeHTML(g.name)}">Edit</button>
          <button class="btn btn-danger btn-sm btn-delete" aria-label="Delete ${escapeHTML(g.name)}">Delete</button>
        </div>
      `;

      item.querySelector('.btn-edit').addEventListener('click', () => showEditModal(g));
      item.querySelector('.btn-delete').addEventListener('click', () => handleDelete(g));
      manageList.appendChild(item);
    });
  } catch (err) {
    console.error('Error loading manage groups:', err);
    manageLoading.classList.add('hidden');
  }
}

function showEditModal(group) {
  editId.value = group.id;
  editName.value = group.name || '';
  editKeywords.value = (group.keywords || []).join(', ');
  editSummary.value = group.summary || '';

  // Subfield
  editSubfield.value = group.subfield || 'computational';

  // Institute (read-only)
  editInstituteDisplay.textContent = group.institute || '(none)';

  // Populate links
  editLinksContainer.innerHTML = '';
  const links = group.links || [];
  if (links.length === 0) {
    addEditLinkRow();
  } else {
    links.forEach(l => addEditLinkRow(l.label, l.url));
  }

  // Show current photo
  editPhotoURL.value = group.photoURL || '';
  if (group.photoURL) {
    editPhotoImg.src = group.photoURL;
    editPhotoCurrentDiv.classList.remove('hidden');
  } else {
    editPhotoCurrentDiv.classList.add('hidden');
  }

  editMessage.classList.add('hidden');
  modalEdit.classList.remove('hidden');
}

export function showEditModalForCreator(group) {
  showEditModal(group);
}

function addEditLinkRow(label = '', url = '') {
  const row = document.createElement('div');
  row.className = 'link-row';
  row.innerHTML = `
    <input type="text" name="link-label" placeholder="Label" value="${escapeHTML(label)}">
    <input type="url" name="link-url" placeholder="https://..." value="${escapeHTML(url)}">
  `;
  editLinksContainer.appendChild(row);
}

export function initEditForm() {
  btnEditAddLink.addEventListener('click', () => addEditLinkRow());

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    editMessage.classList.add('hidden');

    const id = editId.value;
    const name = editName.value.trim();
    if (!name) {
      showMsg(editMessage, 'Name is required.', 'error');
      return;
    }

    const keywords = editKeywords.value.split(',').map(k => k.trim()).filter(Boolean);
    const summary = editSummary.value.trim();
    const subfield = editSubfield.value;

    const linkRows = editLinksContainer.querySelectorAll('.link-row');
    const links = [];
    linkRows.forEach(row => {
      const l = row.querySelector('[name="link-label"]').value.trim();
      const u = row.querySelector('[name="link-url"]').value.trim();
      if (l && u) links.push({ label: l, url: u });
    });

    const photoURL = editPhotoURL.value.trim();
    const updateData = { name, keywords, summary, links, photoURL, subfield };

    const submitBtn = editForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      await updateGroup(id, updateData);
      modalEdit.classList.add('hidden');
      await loadManageGroups();
      await loadGroups();
    } catch (err) {
      console.error('Edit error:', err);
      showMsg(editMessage, 'Error saving changes.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

async function handleDelete(group) {
  if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return;

  try {
    await deleteGroup(group.id);
    await loadManageGroups();
    await loadGroups();
  } catch (err) {
    console.error('Delete error:', err);
    alert('Error deleting group.');
  }
}

// ========== CLAIMS TAB ==========

export async function loadPendingClaims() {
  claimsList.innerHTML = '';
  claimsEmpty.classList.add('hidden');

  try {
    const claims = await fetchPendingClaims();

    if (claims.length === 0) {
      claimsEmpty.classList.remove('hidden');
      return;
    }

    claims.forEach(claim => {
      const item = document.createElement('div');
      item.className = 'admin-item';
      const justificationHTML = claim.justification
        ? `<div class="admin-item-meta"><strong>Justification:</strong> ${escapeHTML(claim.justification)}</div>`
        : '';
      item.innerHTML = `
        <div class="admin-item-info">
          <div class="admin-item-name">${escapeHTML(claim.piName)}</div>
          <div class="admin-item-meta">Claimed by: ${escapeHTML(claim.claimantEmail)}</div>
          ${justificationHTML}
        </div>
        <div class="admin-item-actions">
          <button class="btn btn-success btn-sm btn-approve-claim" aria-label="Approve claim">Approve</button>
          <button class="btn btn-danger btn-sm btn-reject-claim" aria-label="Reject claim">Reject</button>
        </div>
      `;

      item.querySelector('.btn-approve-claim').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          await approveClaim(claim.id);
          await loadPendingClaims();
          await loadGroups();
        } catch (err) {
          console.error('Approve claim error:', err);
          alert('Error approving claim.');
          btn.disabled = false;
        }
      });

      item.querySelector('.btn-reject-claim').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        if (!confirm(`Reject claim by ${claim.claimantEmail}?`)) return;
        btn.disabled = true;
        try {
          await rejectClaim(claim.id);
          await loadPendingClaims();
        } catch (err) {
          console.error('Reject claim error:', err);
          alert('Error rejecting claim.');
          btn.disabled = false;
        }
      });

      claimsList.appendChild(item);
    });
  } catch (err) {
    console.error('Error loading pending claims:', err);
  }
}

// ========== ADMINS TAB ==========

export async function loadAdmins() {
  adminsList.innerHTML = '';
  try {
    const admins = await fetchAdmins();
    const currentUser = getCurrentUser();

    admins.forEach(a => {
      const item = document.createElement('div');
      item.className = 'admin-item';
      const isSelf = a.uid === currentUser?.uid;
      item.innerHTML = `
        <div class="admin-item-info">
          <div class="admin-item-name">${escapeHTML(a.email)}${isSelf ? ' (you)' : ''}</div>
        </div>
        <div class="admin-item-actions">
          ${!isSelf ? `<button class="btn btn-danger btn-sm btn-remove-admin" aria-label="Remove ${escapeHTML(a.email)}">Remove</button>` : ''}
        </div>
      `;

      if (!isSelf) {
        item.querySelector('.btn-remove-admin').addEventListener('click', async () => {
          if (!confirm(`Remove admin ${a.email}?`)) return;
          try {
            await removeAdmin(a.uid);
            await loadAdmins();
          } catch (err) {
            console.error('Remove admin error:', err);
            alert('Error removing admin.');
          }
        });
      }

      adminsList.appendChild(item);
    });
  } catch (err) {
    console.error('Error loading admins:', err);
  }
}

export function initAddAdmin() {
  btnAddAdmin.addEventListener('click', async () => {
    adminAddMessage.classList.add('hidden');
    const email = newAdminEmail.value.trim();
    const password = newAdminPassword.value.trim();

    if (!email || !password) {
      showMsg(adminAddMessage, 'Email and password are required.', 'error');
      return;
    }

    if (password.length < 6) {
      showMsg(adminAddMessage, 'Password must be at least 6 characters.', 'error');
      return;
    }

    btnAddAdmin.disabled = true;

    try {
      await createAdminUser(email, password, getCurrentUser().uid);
      newAdminEmail.value = '';
      newAdminPassword.value = '';
      showMsg(adminAddMessage, 'Admin added successfully.', 'success');
      await loadAdmins();
    } catch (err) {
      console.error('Add admin error:', err);
      showMsg(adminAddMessage, err.message || 'Error adding admin.', 'error');
    } finally {
      btnAddAdmin.disabled = false;
    }
  });
}

// ========== INSTITUTES TAB ==========

export async function loadPendingInstitutes() {
  institutesPendingList.innerHTML = '';
  institutesPendingEmpty.classList.add('hidden');

  try {
    const pending = await fetchPendingInstitutes();

    if (pending.length === 0) {
      institutesPendingEmpty.classList.remove('hidden');
      return;
    }

    pending.forEach(inst => {
      const item = document.createElement('div');
      item.className = 'admin-item';
      item.innerHTML = `
        <div class="admin-item-info">
          <div class="admin-item-name">${escapeHTML(inst.name)}</div>
          <div class="admin-item-meta">Proposed by: ${escapeHTML(inst.proposedBy || 'unknown')}</div>
        </div>
        <div class="admin-item-actions">
          <button class="btn btn-success btn-sm btn-approve-inst" aria-label="Approve ${escapeHTML(inst.name)}">Approve</button>
          <button class="btn btn-danger btn-sm btn-reject-inst" aria-label="Reject ${escapeHTML(inst.name)}">Reject</button>
        </div>
      `;

      item.querySelector('.btn-approve-inst').addEventListener('click', async () => {
        try {
          await approveInstitute(inst.id);
          await loadPendingInstitutes();
          await loadApprovedInstitutes();
          await loadInstituteOptions();
          await loadPublicInstitutes();
        } catch (err) {
          console.error('Approve institute error:', err);
          alert('Error approving institute.');
        }
      });

      item.querySelector('.btn-reject-inst').addEventListener('click', async () => {
        if (!confirm(`Reject and delete institute "${inst.name}"?`)) return;
        try {
          await rejectInstitute(inst.id);
          await loadPendingInstitutes();
        } catch (err) {
          console.error('Reject institute error:', err);
          alert('Error rejecting institute.');
        }
      });

      institutesPendingList.appendChild(item);
    });
  } catch (err) {
    console.error('Error loading pending institutes:', err);
  }
}

export async function loadApprovedInstitutes() {
  institutesApprovedList.innerHTML = '';
  institutesApprovedEmpty.classList.add('hidden');

  try {
    const approved = await fetchApprovedInstitutes();

    if (approved.length === 0) {
      institutesApprovedEmpty.classList.remove('hidden');
      return;
    }

    approved.forEach(inst => {
      const item = document.createElement('div');
      item.className = 'admin-item';
      item.innerHTML = `
        <div class="admin-item-info">
          <div class="admin-item-name">${escapeHTML(inst.name)}</div>
        </div>
      `;
      institutesApprovedList.appendChild(item);
    });
  } catch (err) {
    console.error('Error loading approved institutes:', err);
  }
}

// ========== HELPERS ==========

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = `form-message ${type}`;
  el.classList.remove('hidden');
}
