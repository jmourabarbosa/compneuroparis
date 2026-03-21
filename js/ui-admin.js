import {
  fetchPendingSubmissions, approveSubmission, rejectSubmission,
  fetchGroups, fetchGroupById, fetchInstituteById, updateGroup, deleteGroup,
  fetchAdmins, removeAdmin,
  fetchApprovedInstitutes, fetchPendingInstitutes,
  approveInstitute, rejectInstitute, updateInstitute, deleteInstitute,
  fetchPendingClaims, approveClaim, rejectClaim,
  fetchOpenReports, resolveReport,
  fetchOpenMessages, resolveMessage,
  listAllUsers, deleteUserAccount, updateUserAccount, verifyUserAccount,
  fetchGroupsClaimedBy, fetchInstitutesClaimedBy, revokeClaim,
  fetchNotificationSettings, updateNotificationSettings, setGroupClaimAdmin
} from './db.js';
import { getCurrentUser, getIsAdmin, createAdminUser } from './auth.js';
import { loadGroups, loadPublicInstitutes } from './ui-groups.js';
import { getSubfieldsFromPicker, setSubfieldDropdown, syncSecondaryCheckboxes } from './ui-form.js';
import { loadInstituteOptions } from './ui-form.js';
import { getImageUrlValidationMessage, validateImageUrl } from './image-url-utils.mjs';
import { canSubmitWithPhotoUrlWarning, getPhotoUrlWarningState } from './photo-url-warning-utils.mjs';
import {
  buildClaimantOptionData,
  buildInstitutePillsMarkup,
  buildManageGroupItemMarkup,
  buildUserAdminItemMarkup,
  filterManageGroups,
  filterUsers,
  getClaimSectionSummary,
  getManageGroupsEmptyMessage,
  getUsersEmptyMessage
} from './admin-utils.mjs';
import { buildInstituteFieldData, resolveInstituteRefsFromRecord, toArray } from './institute-links.mjs';
import { escapeHTML } from './public-card-utils.mjs';

// DOM refs
const pendingList = document.getElementById('pending-list');
const pendingLoading = document.getElementById('pending-loading');
const pendingEmpty = document.getElementById('pending-empty');
const manageList = document.getElementById('manage-list');
const manageLoading = document.getElementById('manage-loading');
const manageEmpty = document.getElementById('manage-empty');
const manageSearchInput = document.getElementById('manage-search-input');
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
const reviewPrimarySubfield = document.getElementById('review-primary-subfield');
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
const editPhotoWarning = document.getElementById('edit-photo-warning');
const editPhotoWarningAckRow = document.getElementById('edit-photo-warning-ack-row');
const editPhotoWarningAck = document.getElementById('edit-photo-warning-ack');
const editMessage = document.getElementById('edit-message');
const editClaimSection = document.getElementById('edit-claim-section');
const editClaimCurrent = document.getElementById('edit-claim-current');
const editClaimedBySelect = document.getElementById('edit-claimed-by-select');
const btnEditClaimSave = document.getElementById('btn-edit-claim-save');
const editClaimMessage = document.getElementById('edit-claim-message');
const editPrimarySubfield = document.getElementById('edit-primary-subfield');
const editInstituteSelect = document.getElementById('edit-institute-select');
const editInstitutePills = document.getElementById('edit-institute-pills');

// Edit institute state
let editSelectedInstitutes = [];

// Institute edit modal
const modalEditInstitute = document.getElementById('modal-edit-institute');
const editInstForm = document.getElementById('edit-institute-form');
const editInstId = document.getElementById('edit-inst-id');
const editInstName = document.getElementById('edit-inst-name');
const editInstWebsite = document.getElementById('edit-inst-website');
const editInstKeywords = document.getElementById('edit-inst-keywords');
const editInstSummary = document.getElementById('edit-inst-summary');
const editInstLinksContainer = document.getElementById('edit-inst-links-container');
const btnEditInstAddLink = document.getElementById('btn-edit-inst-add-link');
const editInstLogoURL = document.getElementById('edit-inst-logo-url');
const editInstLogoCurrentDiv = document.getElementById('edit-inst-logo-current');
const editInstLogoImg = document.getElementById('edit-inst-logo-img');
const editInstMessage = document.getElementById('edit-inst-message');

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

// Reports tab
const reportsList = document.getElementById('reports-list');
const reportsEmpty = document.getElementById('reports-empty');

// Messages tab
const messagesList = document.getElementById('messages-list');
const messagesEmpty = document.getElementById('messages-empty');

// Users tab
const usersList = document.getElementById('users-list');
const usersEmpty = document.getElementById('users-empty');
const usersLoading = document.getElementById('users-loading');
const usersSearchInput = document.getElementById('users-search-input');

// Edit user modal
const modalEditUser = document.getElementById('modal-edit-user');
const editUserForm = document.getElementById('edit-user-form');
const editUserUid = document.getElementById('edit-user-uid');
const editUserEmail = document.getElementById('edit-user-email');
const editUserDisplayName = document.getElementById('edit-user-display-name');
const editUserMessage = document.getElementById('edit-user-message');
const editUserClaimed = document.getElementById('edit-user-claimed');
const editUserClaimedList = document.getElementById('edit-user-claimed-list');

let currentSubmission = null;
let currentEditGroup = null;
let cachedManageGroups = [];
let cachedUsers = [];
let approvedInstitutesPromise = null;
let usersCachePromise = null;
let editModalLoadToken = 0;

function notifyAdminDataChanged() {
  document.dispatchEvent(new CustomEvent('admin-data-changed'));
}

// Cache for institute status lookups
let approvedInstitutes = [];
let approvedInstitutesById = new Map();
let instituteLookupById = new Map();
const EDIT_PHOTO_WARNING_DEBOUNCE_MS = 500;
const editPhotoValidationState = {
  validationResult: null,
  isChecking: false,
  acknowledged: false,
  lastValidatedUrl: '',
  pendingPromise: null,
  debounceTimer: null
};

function setInstituteCaches(approvedInstitutesList = [], lookupInstitutes = []) {
  approvedInstitutes = approvedInstitutesList;
  approvedInstitutesById = new Map(approvedInstitutesList.map(inst => [inst.id, inst]));
  instituteLookupById = new Map(lookupInstitutes.map(inst => [inst.id, inst]));
}

function getInstituteLookupList() {
  return [...instituteLookupById.values()];
}

async function ensureApprovedInstitutesCache(forceRefresh = false) {
  if (!forceRefresh && approvedInstitutes.length > 0) return approvedInstitutes;
  if (approvedInstitutesPromise) return approvedInstitutesPromise;

  approvedInstitutesPromise = Promise.all([
    fetchApprovedInstitutes(),
    fetchPendingInstitutes().catch(() => [])
  ])
    .then(([approved, pending]) => {
      setInstituteCaches(approved, [...approved, ...pending]);
      return approvedInstitutes;
    })
    .finally(() => {
      approvedInstitutesPromise = null;
    });

  return approvedInstitutesPromise;
}

async function ensureUsersCache(forceRefresh = false) {
  if (!forceRefresh && cachedUsers.length > 0) return cachedUsers;
  if (usersCachePromise) return usersCachePromise;

  usersCachePromise = listAllUsers()
    .then((users) => {
      cachedUsers = users;
      return cachedUsers;
    })
    .finally(() => {
      usersCachePromise = null;
    });

  return usersCachePromise;
}

function renderEditInstituteOptions() {
  editInstituteSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = 'Select institution...';
  editInstituteSelect.appendChild(placeholder);

  approvedInstitutes.forEach(inst => {
    const opt = document.createElement('option');
    opt.value = inst.id;
    opt.textContent = inst.name;
    editInstituteSelect.appendChild(opt);
  });
}

function renderLoadingOption(selectEl, text) {
  selectEl.innerHTML = '';
  const option = document.createElement('option');
  option.value = '';
  option.textContent = text;
  option.disabled = true;
  option.selected = true;
  selectEl.appendChild(option);
  selectEl.disabled = true;
}

function clearEditPhotoValidationDebounce() {
  if (editPhotoValidationState.debounceTimer) {
    clearTimeout(editPhotoValidationState.debounceTimer);
    editPhotoValidationState.debounceTimer = null;
  }
}

function renderEditPhotoWarning() {
  const warningState = getPhotoUrlWarningState({
    hasValue: Boolean(editPhotoURL.value.trim()),
    isChecking: editPhotoValidationState.isChecking,
    validationResult: editPhotoValidationState.validationResult,
    acknowledged: editPhotoValidationState.acknowledged
  });

  if (warningState.hidden) {
    editPhotoWarning.classList.add('hidden');
    editPhotoWarning.textContent = '';
  } else {
    editPhotoWarning.textContent = warningState.message;
    editPhotoWarning.className = `form-message ${warningState.tone}`;
    editPhotoWarning.classList.remove('hidden');
  }

  if (!editPhotoWarningAckRow || !editPhotoWarningAck) return;
  editPhotoWarningAckRow.classList.toggle('hidden', !warningState.requiresAcknowledgement);
  editPhotoWarningAck.checked = warningState.acknowledged;
}

function resetEditPhotoValidationState() {
  clearEditPhotoValidationDebounce();
  editPhotoValidationState.validationResult = null;
  editPhotoValidationState.isChecking = false;
  editPhotoValidationState.acknowledged = false;
  editPhotoValidationState.lastValidatedUrl = '';
  editPhotoValidationState.pendingPromise = null;
  renderEditPhotoWarning();
}

function handleEditPhotoInput() {
  editPhotoValidationState.validationResult = null;
  editPhotoValidationState.lastValidatedUrl = '';
  editPhotoValidationState.acknowledged = false;
  clearEditPhotoValidationDebounce();

  const photoUrl = editPhotoURL.value.trim();
  if (!photoUrl) {
    editPhotoValidationState.isChecking = false;
    renderEditPhotoWarning();
    return;
  }

  editPhotoValidationState.debounceTimer = setTimeout(() => {
    editPhotoValidationState.debounceTimer = null;
    void validateEditPhotoUrl();
  }, EDIT_PHOTO_WARNING_DEBOUNCE_MS);

  renderEditPhotoWarning();
}

async function validateEditPhotoUrl({ immediate = false } = {}) {
  clearEditPhotoValidationDebounce();

  const photoUrl = editPhotoURL.value.trim();
  if (!photoUrl) {
    editPhotoValidationState.validationResult = null;
    editPhotoValidationState.lastValidatedUrl = '';
    editPhotoValidationState.isChecking = false;
    editPhotoValidationState.pendingPromise = null;
    renderEditPhotoWarning();
    return null;
  }

  if (!immediate && editPhotoValidationState.pendingPromise && editPhotoValidationState.lastValidatedUrl === photoUrl) {
    return editPhotoValidationState.pendingPromise;
  }

  editPhotoValidationState.isChecking = true;
  editPhotoValidationState.lastValidatedUrl = photoUrl;
  renderEditPhotoWarning();

  const pendingPromise = validateImageUrl(photoUrl)
    .then((result) => {
      if (editPhotoURL.value.trim() !== photoUrl) return result;
      editPhotoValidationState.validationResult = result;
      editPhotoValidationState.lastValidatedUrl = photoUrl;
      return result;
    })
    .finally(() => {
      if (editPhotoURL.value.trim() === photoUrl) {
        editPhotoValidationState.isChecking = false;
        renderEditPhotoWarning();
      }
      if (editPhotoValidationState.pendingPromise === pendingPromise) {
        editPhotoValidationState.pendingPromise = null;
      }
    });

  editPhotoValidationState.pendingPromise = pendingPromise;
  return pendingPromise;
}

async function refreshManageAndPublicGroups() {
  await Promise.all([loadManageGroups(), loadGroups()]);
}

async function refreshInstituteViews() {
  await Promise.all([loadApprovedInstitutes(), loadInstituteOptions(), loadPublicInstitutes()]);
}

export function primeEditModalReferenceData() {
  void ensureApprovedInstitutesCache().then(() => {
    renderEditInstituteOptions();
  }).catch(err => {
    console.error('Error preloading institute cache:', err);
  });
  void ensureUsersCache().catch(err => {
    console.error('Error preloading users cache:', err);
  });
}

// ========== TABS ==========

export function initTabs() {
  const adminModal = document.getElementById('modal-admin');
  if (!adminModal) return;
  const tabs = adminModal.querySelectorAll('.tab');
  const panels = adminModal.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      // Update tabs
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      // Update panels
      panels.forEach(p => p.classList.remove('active'));
      document.getElementById(target).classList.add('active');

      // Auto-load reports/messages/users/settings when tab is selected
      if (target === 'tab-reports') {
        loadReports();
      } else if (target === 'tab-messages') {
        loadMessages();
      } else if (target === 'tab-users') {
        loadUsers();
      } else if (target === 'tab-settings') {
        loadSettings();
      }
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
    await ensureApprovedInstitutesCache(true);
  } catch (err) {
    console.error('Error fetching approved institutes:', err);
  }

  // Populate editable fields
  reviewName.value = sub.name || '';
  reviewKeywords.value = (sub.keywords || []).join(', ');
  reviewSummary.value = sub.summary || '';
  reviewPhotoURL.value = sub.photoURL || '';

  // Subfield dropdown
  const subfields = toArray(sub.subfields || sub.subfield || 'computational');
  setSubfieldDropdown(reviewPrimarySubfield, 'review-secondary', subfields);

  // Institute display + warning
  const instituteRefs = resolveInstituteRefsFromRecord(sub, getInstituteLookupList());
  const institutes = instituteRefs.map(ref => ref.name || ref.id);
  const instName = institutes.join(', ') || '';
  reviewInstituteDisplay.textContent = instName || '(none)';
  const isPending = instituteRefs.length > 0 && instituteRefs.some(ref => !approvedInstitutesById.has(ref.id));
  if (isPending) {
    reviewInstituteWarning.classList.remove('hidden');
    btnApprove.disabled = true;
    btnApprove.title = 'Institution must be approved first';
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
  if (typeof sub.submitterIsPi === 'boolean') metaParts.push(`<p><strong>Submitter is this PI:</strong> ${sub.submitterIsPi ? 'Yes' : 'No'}</p>`);
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
  const subfields = getSubfieldsFromPicker(reviewPrimarySubfield, 'review-secondary');
  if (subfields.length === 0) subfields.push('computational');

  const linkRows = reviewLinksContainer.querySelectorAll('.link-row');
  const links = [];
  linkRows.forEach(row => {
    const l = row.querySelector('[name="link-label"]').value.trim();
    const u = row.querySelector('[name="link-url"]').value.trim();
    if (l && u) links.push({ label: l, url: u });
  });

  // Institute comes from original submission (read-only in review)
  const instituteRefs = resolveInstituteRefsFromRecord(currentSubmission, getInstituteLookupList());

  return {
    name,
    keywords,
    summary,
    links,
    photoURL,
    subfields,
    subfield: subfields[0],
    ...buildInstituteFieldData(instituteRefs)
  };
}

export function initSubmissionActions() {
  reviewPrimarySubfield.addEventListener('change', () => syncSecondaryCheckboxes(reviewPrimarySubfield, 'review-secondary'));
  btnReviewAddLink.addEventListener('click', () => addReviewLinkRow());

  btnApprove.addEventListener('click', async () => {
    if (!currentSubmission) return;
    btnApprove.disabled = true;
    try {
      const user = getCurrentUser();
      const overrideData = getReviewFormData();
      const photoValidation = await validateImageUrl(overrideData.photoURL);
      if (!photoValidation.valid) {
        alert(getImageUrlValidationMessage(photoValidation, 'PI photo URL'));
        return;
      }
      await approveSubmission(currentSubmission.id, user.uid, overrideData);
      modalSubmission.classList.add('hidden');
      await Promise.all([loadPending(), loadGroups()]);
      notifyAdminDataChanged();
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
      notifyAdminDataChanged();
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
    cachedManageGroups = groups;
    manageLoading.classList.add('hidden');
    renderManageGroups();
  } catch (err) {
    console.error('Error loading manage groups:', err);
    manageLoading.classList.add('hidden');
  }
}

function renderManageGroups() {
  manageList.innerHTML = '';
  manageEmpty.classList.add('hidden');

  const term = (manageSearchInput?.value || '').trim().toLowerCase();
  const filteredGroups = filterManageGroups(cachedManageGroups, term);

  if (filteredGroups.length === 0) {
    manageEmpty.classList.remove('hidden');
    manageEmpty.querySelector('p').textContent = getManageGroupsEmptyMessage(term);
    return;
  }

  filteredGroups.forEach(g => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    item.innerHTML = buildManageGroupItemMarkup(g);

    item.querySelector('.btn-edit').addEventListener('click', () => { void showEditModal(g); });
    item.querySelector('.btn-delete').addEventListener('click', () => handleDelete(g));
    manageList.appendChild(item);
  });
}

function updateClaimSectionSummary(group) {
  editClaimCurrent.textContent = getClaimSectionSummary(group);
}

async function populateClaimantOptions(group, loadToken = editModalLoadToken) {
  editClaimMessage.classList.add('hidden');
  renderLoadingOption(editClaimedBySelect, 'Loading accounts...');
  try {
    const users = await ensureUsersCache();
    if (loadToken !== editModalLoadToken || currentEditGroup?.id !== group.id) return;
    buildClaimantOptionData(users, group).forEach(optionData => {
      const option = document.createElement('option');
      option.value = optionData.value;
      option.textContent = optionData.label;
      editClaimedBySelect.appendChild(option);
    });

    editClaimedBySelect.value = group.claimedBy || '';
    editClaimedBySelect.disabled = false;
  } catch (err) {
    console.error('Error loading claimable users:', err);
    showMsg(editClaimMessage, 'Error loading user accounts.', 'error');
  }
}

async function showEditModal(group) {
  const loadToken = ++editModalLoadToken;
  currentEditGroup = { ...group };
  editId.value = group.id;
  editName.value = group.name || '';
  editKeywords.value = (group.keywords || []).join(', ');
  editSummary.value = group.summary || '';

  // Subfield dropdown
  const subfields = toArray(group.subfields || group.subfield || 'computational');
  setSubfieldDropdown(editPrimarySubfield, 'edit-secondary', subfields);

  editSelectedInstitutes = resolveInstituteRefsFromRecord(group, getInstituteLookupList());
  renderEditInstitutePills();
  renderLoadingOption(editInstituteSelect, 'Loading institutions...');

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
  resetEditPhotoValidationState();
  if (group.photoURL) {
    editPhotoImg.src = group.photoURL;
    editPhotoCurrentDiv.classList.remove('hidden');
  } else {
    editPhotoCurrentDiv.classList.add('hidden');
  }

  // Hiring checkbox
  document.getElementById('edit-hiring-checkbox').checked = !!group.hiring;

  editMessage.classList.add('hidden');
  updateClaimSectionSummary(group);
  if (getIsAdmin()) {
    editClaimSection.classList.remove('hidden');
    renderLoadingOption(editClaimedBySelect, 'Loading accounts...');
  } else {
    editClaimSection.classList.add('hidden');
    editClaimMessage.classList.add('hidden');
    editClaimedBySelect.innerHTML = '<option value="">Unclaimed</option>';
    editClaimedBySelect.value = '';
  }
  modalEdit.classList.remove('hidden');

  void loadEditInstituteOptions().then(() => {
    if (loadToken !== editModalLoadToken || currentEditGroup?.id !== group.id) return;
    editSelectedInstitutes = resolveInstituteRefsFromRecord(group, getInstituteLookupList());
    renderEditInstitutePills();
  });

  if (getIsAdmin()) {
    void populateClaimantOptions(group, loadToken).catch((err) => {
      console.error('Error hydrating claimant options:', err);
    });
  }
}

export function showEditModalForCreator(group) {
  void showEditModal(group);
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

async function loadEditInstituteOptions() {
  try {
    await ensureApprovedInstitutesCache();
    renderEditInstituteOptions();
  } catch (err) {
    console.error('Error loading edit institute options:', err);
  }
}

function handleEditAddInstitute() {
  const value = editInstituteSelect.value;
  if (!value || editSelectedInstitutes.some(inst => inst.id === value)) return;
  const selectedOption = editInstituteSelect.options[editInstituteSelect.selectedIndex];
  editSelectedInstitutes.push({ id: value, name: selectedOption?.textContent || value });
  editInstituteSelect.selectedIndex = 0;
  renderEditInstitutePills();
}

function renderEditInstitutePills() {
  editInstitutePills.innerHTML = buildInstitutePillsMarkup(editSelectedInstitutes);
  editInstitutePills.querySelectorAll('.institute-pill-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      editSelectedInstitutes = editSelectedInstitutes.filter(inst => (inst.id || inst.name) !== btn.dataset.key);
      renderEditInstitutePills();
    });
  });
}

async function persistClaimantSelection() {
  if (!currentEditGroup) return false;

  const nextClaimantUid = editClaimedBySelect.value;
  const currentClaimantUid = currentEditGroup.claimedBy || '';
  editClaimMessage.classList.add('hidden');

  if (nextClaimantUid === currentClaimantUid) {
    return false;
  }

  const result = await setGroupClaimAdmin(currentEditGroup.id, nextClaimantUid);
  currentEditGroup.claimedBy = result.claimedBy || '';
  currentEditGroup.claimedByEmail = result.claimedByEmail || '';
  currentEditGroup.claimedByName = result.claimedByName || '';
  updateClaimSectionSummary(currentEditGroup);
  editClaimedBySelect.value = result.claimedBy || '';
  showMsg(
    editClaimMessage,
    result.claimedBy
      ? 'Claimant updated successfully.'
      : 'Claim removed. This PI page is now unclaimed.',
    'success'
  );
  return true;
}

export function initEditForm() {
  editPrimarySubfield.addEventListener('change', () => syncSecondaryCheckboxes(editPrimarySubfield, 'edit-secondary'));
  btnEditAddLink.addEventListener('click', () => addEditLinkRow());
  editPhotoURL.addEventListener('input', handleEditPhotoInput);
  editPhotoURL.addEventListener('blur', () => { void validateEditPhotoUrl({ immediate: true }); });
  editPhotoWarningAck?.addEventListener('change', () => {
    editPhotoValidationState.acknowledged = !!editPhotoWarningAck.checked;
    renderEditPhotoWarning();
  });
  editInstituteSelect.addEventListener('change', () => {
    handleEditAddInstitute();
  });
  btnEditClaimSave.addEventListener('click', async () => {
    btnEditClaimSave.disabled = true;
    try {
      const changed = await persistClaimantSelection();
      if (!changed) {
        showMsg(editClaimMessage, 'No claimant change to save.', 'success');
      }
      await refreshManageAndPublicGroups();
      notifyAdminDataChanged();
    } catch (err) {
      console.error('Set claimant error:', err);
      showMsg(editClaimMessage, err.message || 'Error updating claimant.', 'error');
    } finally {
      btnEditClaimSave.disabled = false;
    }
  });

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
    const subfields = getSubfieldsFromPicker(editPrimarySubfield, 'edit-secondary');
    if (subfields.length === 0) subfields.push('computational');

    const linkRows = editLinksContainer.querySelectorAll('.link-row');
    const links = [];
    linkRows.forEach(row => {
      const l = row.querySelector('[name="link-label"]').value.trim();
      const u = row.querySelector('[name="link-url"]').value.trim();
      if (l && u) links.push({ label: l, url: u });
    });

    const photoURL = editPhotoURL.value.trim();
    if (!photoURL) {
      showMsg(editMessage, 'PI photo URL is required.', 'error');
      return;
    }
    const photoValidation = await validateEditPhotoUrl({ immediate: true });
    if (!canSubmitWithPhotoUrlWarning({
      hasValue: Boolean(photoURL),
      isChecking: editPhotoValidationState.isChecking,
      validationResult: photoValidation,
      acknowledged: editPhotoValidationState.acknowledged
    })) {
      showMsg(editMessage, 'The PI photo link may be broken. If you still want to continue, tick the confirmation box under the photo field and save again.', 'error');
      editPhotoWarningAckRow?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      editPhotoWarningAck?.focus();
      return;
    }
    const hiring = document.getElementById('edit-hiring-checkbox').checked;
    const updateData = {
      name,
      keywords,
      summary,
      links,
      photoURL,
      subfields,
      subfield: subfields[0],
      ...buildInstituteFieldData(editSelectedInstitutes),
      hiring,
      lastEditedBy: getCurrentUser()?.uid
    };

    const submitBtn = editForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    btnEditClaimSave.disabled = true;

    try {
      await updateGroup(id, updateData);
      const claimChanged = getIsAdmin() ? await persistClaimantSelection() : false;
      modalEdit.classList.add('hidden');
      await refreshManageAndPublicGroups();
      if (claimChanged) {
        notifyAdminDataChanged();
      }
    } catch (err) {
      console.error('Edit error:', err);
      showMsg(editMessage, 'Error saving changes.', 'error');
    } finally {
      submitBtn.disabled = false;
      btnEditClaimSave.disabled = false;
    }
  });
}

async function handleDelete(group) {
  if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return;

  try {
    await deleteGroup(group.id);
    await refreshManageAndPublicGroups();
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
      const claimType = claim.type || 'pi';
      const typeBadge = `<span class="admin-item-type-badge admin-item-type-badge--${claimType}">[${claimType === 'institute' ? 'Institution' : 'PI'}]</span>`;
      const targetName = claim.targetName || claim.piName;
      const justificationHTML = claim.justification
        ? `<div class="admin-item-meta"><strong>Justification:</strong> ${escapeHTML(claim.justification)}</div>`
        : '';
      item.innerHTML = `
        <div class="admin-item-info">
          <div class="admin-item-name">${typeBadge} ${escapeHTML(targetName)}</div>
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
          await Promise.all([loadPendingClaims(), loadGroups(), loadPublicInstitutes()]);
          notifyAdminDataChanged();
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
          notifyAdminDataChanged();
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
            notifyAdminDataChanged();
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
          await Promise.all([loadPendingInstitutes(), refreshInstituteViews()]);
          notifyAdminDataChanged();
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
          notifyAdminDataChanged();
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
    const approved = await ensureApprovedInstitutesCache(true);

    if (approved.length === 0) {
      institutesApprovedEmpty.classList.remove('hidden');
      return;
    }

    approved.forEach(inst => {
      const item = document.createElement('div');
      item.className = 'admin-item';
      const claimedLabel = inst.claimedBy ? ' (claimed)' : '';
      item.innerHTML = `
        <div class="admin-item-info">
          <div class="admin-item-name">${escapeHTML(inst.name)}${claimedLabel}</div>
        </div>
        <div class="admin-item-actions">
          <button class="btn btn-primary btn-sm btn-edit-inst" aria-label="Edit ${escapeHTML(inst.name)}">Edit</button>
          <button class="btn btn-danger btn-sm btn-delete-inst" aria-label="Delete ${escapeHTML(inst.name)}">Delete</button>
        </div>
      `;

      item.querySelector('.btn-edit-inst').addEventListener('click', () => showEditInstituteModal(inst));
      item.querySelector('.btn-delete-inst').addEventListener('click', async () => {
        if (!confirm(`Delete "${inst.name}"? This cannot be undone.`)) return;
        try {
          await deleteInstitute(inst.id);
          await refreshInstituteViews();
          notifyAdminDataChanged();
        } catch (err) {
          console.error('Delete institute error:', err);
          alert('Error deleting institute.');
        }
      });

      institutesApprovedList.appendChild(item);
    });
  } catch (err) {
    console.error('Error loading approved institutes:', err);
  }
}

// ========== INSTITUTE EDIT ==========

function showEditInstituteModal(inst) {
  editInstId.value = inst.id;
  editInstName.value = inst.name || '';
  editInstWebsite.value = inst.website || '';
  editInstKeywords.value = (inst.keywords || []).join(', ');
  editInstSummary.value = inst.summary || '';

  // Populate links
  editInstLinksContainer.innerHTML = '';
  const links = inst.links || [];
  if (links.length === 0) {
    addEditInstLinkRow();
  } else {
    links.forEach(l => addEditInstLinkRow(l.label, l.url));
  }

  // Logo
  editInstLogoURL.value = inst.logoURL || '';
  if (inst.logoURL) {
    editInstLogoImg.src = inst.logoURL;
    editInstLogoCurrentDiv.classList.remove('hidden');
  } else {
    editInstLogoCurrentDiv.classList.add('hidden');
  }

  editInstMessage.classList.add('hidden');
  modalEditInstitute.classList.remove('hidden');
}

export function showEditInstituteModalForCreator(inst) {
  showEditInstituteModal(inst);
}

function addEditInstLinkRow(label = '', url = '') {
  const row = document.createElement('div');
  row.className = 'link-row';
  row.innerHTML = `
    <input type="text" name="link-label" placeholder="Label" value="${escapeHTML(label)}">
    <input type="url" name="link-url" placeholder="https://..." value="${escapeHTML(url)}">
  `;
  editInstLinksContainer.appendChild(row);
}

export function initEditInstituteForm() {
  btnEditInstAddLink.addEventListener('click', () => addEditInstLinkRow());

  editInstForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    editInstMessage.classList.add('hidden');

    const id = editInstId.value;
    const name = editInstName.value.trim();
    if (!name) {
      showMsg(editInstMessage, 'Name is required.', 'error');
      return;
    }

    const website = editInstWebsite.value.trim();
    const keywords = editInstKeywords.value.split(',').map(k => k.trim()).filter(Boolean);
    const summary = editInstSummary.value.trim();

    const linkRows = editInstLinksContainer.querySelectorAll('.link-row');
    const links = [];
    linkRows.forEach(row => {
      const l = row.querySelector('[name="link-label"]').value.trim();
      const u = row.querySelector('[name="link-url"]').value.trim();
      if (l && u) links.push({ label: l, url: u });
    });

    const logoURL = editInstLogoURL.value.trim();
    const updateData = { name, website, keywords, summary, links, logoURL };

    const submitBtn = editInstForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      await updateInstitute(id, updateData);
      modalEditInstitute.classList.add('hidden');
      await refreshInstituteViews();
    } catch (err) {
      console.error('Edit institute error:', err);
      showMsg(editInstMessage, 'Error saving changes.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// ========== REPORTS TAB ==========

export async function loadReports() {
  reportsList.innerHTML = '';
  reportsEmpty.classList.add('hidden');

  try {
    const reports = await fetchOpenReports();

    if (reports.length === 0) {
      reportsEmpty.classList.remove('hidden');
      return;
    }

    reports.forEach(report => {
      const item = document.createElement('div');
      item.className = 'admin-item';
      const typeBadge = `<span class="admin-item-type-badge admin-item-type-badge--${report.type}">[${report.type === 'institute' ? 'Institution' : 'PI'}]</span>`;
      const reporterHTML = report.reporterEmail
        ? `<div class="admin-item-meta">Reported by: ${escapeHTML(report.reporterEmail)}</div>`
        : `<div class="admin-item-meta">Reported anonymously</div>`;
      item.innerHTML = `
        <div class="admin-item-info">
          <div class="admin-item-name">${typeBadge} ${escapeHTML(report.targetName)}</div>
          ${reporterHTML}
          <div class="admin-item-meta">${escapeHTML(report.message)}</div>
        </div>
        <div class="admin-item-actions">
          <button class="btn btn-primary btn-sm btn-edit-reported" aria-label="Edit profile">Edit</button>
          <button class="btn btn-success btn-sm btn-resolve-report" aria-label="Resolve report">Resolve</button>
        </div>
      `;

      item.querySelector('.btn-edit-reported').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          if (report.type === 'institute') {
            const inst = await fetchInstituteById(report.targetId);
            if (!inst) { alert('Institution not found.'); return; }
            document.querySelector('#modal-admin').classList.add('hidden');
            document.dispatchEvent(new CustomEvent('creator-edit-institute', { detail: inst }));
          } else {
            const group = await fetchGroupById(report.targetId);
            if (!group) { alert('PI not found.'); return; }
            document.querySelector('#modal-admin').classList.add('hidden');
            document.dispatchEvent(new CustomEvent('creator-edit-group', { detail: group }));
          }
        } catch (err) {
          console.error('Edit reported profile error:', err);
          alert('Error opening profile for editing.');
        } finally {
          btn.disabled = false;
        }
      });

      item.querySelector('.btn-resolve-report').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          await resolveReport(report.id);
          item.remove();
          if (reportsList.children.length === 0) {
            reportsEmpty.classList.remove('hidden');
          }
          notifyAdminDataChanged();
        } catch (err) {
          console.error('Resolve report error:', err);
          alert('Error resolving report.');
          btn.disabled = false;
        }
      });

      reportsList.appendChild(item);
    });
  } catch (err) {
    console.error('Error loading reports:', err);
  }
}

// ========== MESSAGES TAB ==========

export async function loadMessages() {
  messagesList.innerHTML = '';
  messagesEmpty.classList.add('hidden');

  try {
    const messages = await fetchOpenMessages();

    if (messages.length === 0) {
      messagesEmpty.classList.remove('hidden');
      return;
    }

    messages.forEach(msg => {
      const item = document.createElement('div');
      item.className = 'admin-item';
      const emailHTML = msg.email
        ? `<div class="admin-item-meta">From: ${escapeHTML(msg.email)}</div>`
        : `<div class="admin-item-meta">Anonymous</div>`;
      const date = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleDateString() : '';
      item.innerHTML = `
        <div class="admin-item-info">
          ${emailHTML}
          ${date ? `<div class="admin-item-meta">${date}</div>` : ''}
          <div class="admin-item-meta">${escapeHTML(msg.message)}</div>
        </div>
        <div class="admin-item-actions">
          <button class="btn btn-success btn-sm btn-resolve-msg" aria-label="Resolve message">Resolve</button>
        </div>
      `;

      item.querySelector('.btn-resolve-msg').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          await resolveMessage(msg.id);
          item.remove();
          if (messagesList.children.length === 0) {
            messagesEmpty.classList.remove('hidden');
          }
          notifyAdminDataChanged();
        } catch (err) {
          console.error('Resolve message error:', err);
          alert('Error resolving message.');
          btn.disabled = false;
        }
      });

      messagesList.appendChild(item);
    });
  } catch (err) {
    console.error('Error loading messages:', err);
  }
}

// ========== USERS TAB ==========

export async function loadUsers() {
  usersList.innerHTML = '';
  usersEmpty.classList.add('hidden');
  usersLoading.classList.remove('hidden');

  try {
    const users = await ensureUsersCache(true);
    usersLoading.classList.add('hidden');
    renderUsers();
  } catch (err) {
    console.error('Error loading users:', err);
    usersLoading.classList.add('hidden');
  }
}

function renderUsers() {
  usersList.innerHTML = '';
  usersEmpty.classList.add('hidden');

  const term = (usersSearchInput?.value || '').trim().toLowerCase();
  const filteredUsers = filterUsers(cachedUsers, term);

  if (filteredUsers.length === 0) {
    usersEmpty.classList.remove('hidden');
    usersEmpty.querySelector('p').textContent = getUsersEmptyMessage(term);
    return;
  }

  filteredUsers.forEach(u => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    item.innerHTML = buildUserAdminItemMarkup(u);

    const verifyEl = item.querySelector('.btn-verify-user');
    if (verifyEl) {
      verifyEl.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          await verifyUserAccount(u.uid);
          await loadUsers();
        } catch (err) {
          console.error('Verify user error:', err);
          alert('Error verifying user: ' + (err.message || err));
          btn.disabled = false;
        }
      });
    }
    item.querySelector('.btn-edit-user').addEventListener('click', () => showEditUserModal(u));
    item.querySelector('.btn-delete-user').addEventListener('click', () => handleDeleteUser(u));
    usersList.appendChild(item);
  });
}

function initAdminSearch() {
  if (manageSearchInput) {
    manageSearchInput.addEventListener('input', () => {
      renderManageGroups();
    });
  }

  if (usersSearchInput) {
    usersSearchInput.addEventListener('input', () => {
      renderUsers();
    });
  }
}

initAdminSearch();

async function showEditUserModal(user) {
  editUserUid.value = user.uid;
  editUserEmail.value = user.email || '';
  editUserDisplayName.value = user.displayName || '';
  editUserMessage.classList.add('hidden');
  editUserClaimed.classList.add('hidden');
  editUserClaimedList.innerHTML = '';
  modalEditUser.classList.remove('hidden');

  // Fetch claimed pages
  try {
    const [groups, institutes] = await Promise.all([
      fetchGroupsClaimedBy(user.uid),
      fetchInstitutesClaimedBy(user.uid)
    ]);

    if (groups.length === 0 && institutes.length === 0) {
      editUserClaimed.classList.remove('hidden');
      editUserClaimedList.innerHTML = '<p class="admin-item-meta">No claimed pages.</p>';
      return;
    }

    editUserClaimed.classList.remove('hidden');

    groups.forEach(g => {
      const item = document.createElement('div');
      item.className = 'admin-item';
      item.innerHTML = `
        <div class="admin-item-info">
          <div class="admin-item-name"><span class="admin-item-type-badge admin-item-type-badge--pi">[PI]</span> ${escapeHTML(g.name)}</div>
        </div>
        <div class="admin-item-actions">
          <button class="btn btn-danger btn-sm btn-revoke" aria-label="Revoke claim on ${escapeHTML(g.name)}">Revoke</button>
        </div>
      `;
      item.querySelector('.btn-revoke').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        if (!confirm(`Revoke claim on "${g.name}"?`)) return;
        btn.disabled = true;
        try {
          await revokeClaim(g.id, 'pi');
          await showEditUserModal(user);
          await refreshManageAndPublicGroups();
          notifyAdminDataChanged();
        } catch (err) {
          console.error('Revoke claim error:', err);
          alert('Error revoking claim.');
          btn.disabled = false;
        }
      });
      editUserClaimedList.appendChild(item);
    });

    institutes.forEach(inst => {
      const item = document.createElement('div');
      item.className = 'admin-item';
      item.innerHTML = `
        <div class="admin-item-info">
          <div class="admin-item-name"><span class="admin-item-type-badge admin-item-type-badge--institute">[Institution]</span> ${escapeHTML(inst.name)}</div>
        </div>
        <div class="admin-item-actions">
          <button class="btn btn-danger btn-sm btn-revoke" aria-label="Revoke claim on ${escapeHTML(inst.name)}">Revoke</button>
        </div>
      `;
      item.querySelector('.btn-revoke').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        if (!confirm(`Revoke claim on "${inst.name}"?`)) return;
        btn.disabled = true;
        try {
          await revokeClaim(inst.id, 'institute');
          await showEditUserModal(user);
          await Promise.all([loadApprovedInstitutes(), loadPublicInstitutes()]);
          notifyAdminDataChanged();
        } catch (err) {
          console.error('Revoke claim error:', err);
          alert('Error revoking claim.');
          btn.disabled = false;
        }
      });
      editUserClaimedList.appendChild(item);
    });
  } catch (err) {
    console.error('Error fetching claimed pages:', err);
  }
}

async function handleDeleteUser(user) {
  if (!confirm(`Delete user "${user.email}"? This will:\n- Remove their claims\n- Unclaim any PIs/institutes they own\n- Remove them from admins if applicable\n\nThis cannot be undone.`)) return;

  try {
    await deleteUserAccount(user.uid);
    await Promise.all([
      loadUsers(),
      loadManageGroups(),
      loadPendingClaims(),
      loadApprovedInstitutes(),
      loadGroups(),
      loadPublicInstitutes()
    ]);
    notifyAdminDataChanged();
  } catch (err) {
    console.error('Delete user error:', err);
    alert('Error deleting user: ' + (err.message || err));
  }
}

export function initEditUserForm() {
  editUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    editUserMessage.classList.add('hidden');

    const uid = editUserUid.value;
    const email = editUserEmail.value.trim();
    const displayName = editUserDisplayName.value.trim();

    if (!email) {
      showMsg(editUserMessage, 'Email is required.', 'error');
      return;
    }

    const submitBtn = editUserForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      await updateUserAccount(uid, { email, displayName });
      modalEditUser.classList.add('hidden');
      await loadUsers();
    } catch (err) {
      console.error('Update user error:', err);
      showMsg(editUserMessage, 'Error updating user: ' + (err.message || err), 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// ========== SETTINGS TAB ==========

async function loadSettings() {
  try {
    const settings = await fetchNotificationSettings();
    document.getElementById('settings-profile-email').value = settings.profileChangeEmail || '';
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

export function initSettings() {
  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-settings');
    const msg = document.getElementById('settings-message');
    const email = document.getElementById('settings-profile-email').value.trim();

    btn.disabled = true;
    msg.classList.add('hidden');

    try {
      await updateNotificationSettings({ profileChangeEmail: email });
      showMsg(msg, 'Settings saved.', 'success');
    } catch (err) {
      console.error('Error saving settings:', err);
      showMsg(msg, 'Error saving settings.', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

// ========== HELPERS ==========

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = `form-message ${type}`;
  el.classList.remove('hidden');
}
