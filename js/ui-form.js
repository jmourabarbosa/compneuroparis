import { createSubmission, createGroup, fetchApprovedInstitutes, createInstitute } from './db.js';
import { getCurrentUser, getIsAdmin, createAccount, login, logout, resetPassword, isEmailVerified, resendVerification } from './auth.js';
import { loadGroups, loadPublicInstitutes } from './ui-groups.js';

const form = document.getElementById('submission-form');
const formWrapper = document.getElementById('submission-form-wrapper');
const btnShowForm = document.getElementById('btn-show-form');
const formMessage = document.getElementById('form-message');
const linksContainer = document.getElementById('links-container');
const btnAddLink = document.getElementById('btn-add-link');

// Institute submission form
const instForm = document.getElementById('institute-submission-form');
const instFormWrapper = document.getElementById('institute-form-wrapper');
const btnShowInstForm = document.getElementById('btn-show-institute-form');
const instFormMessage = document.getElementById('inst-form-message');

// Institute submission auth
const instSubAuthForm = document.getElementById('inst-sub-auth-form');
const instSubAuthStatus = document.getElementById('inst-sub-auth-status');
const instSubAuthEmail = document.getElementById('inst-sub-auth-email');
const instSubAuthPassword = document.getElementById('inst-sub-auth-password');
const instSubAuthMessage = document.getElementById('inst-sub-auth-message');
const instSubAuthUserEmail = document.getElementById('inst-sub-auth-user-email');
const btnInstSubCreate = document.getElementById('btn-inst-sub-create');
const btnInstSubLogin = document.getElementById('btn-inst-sub-login');
const btnInstSubLogout = document.getElementById('btn-inst-sub-logout');

// Subfield picker & institute
const subSubfieldContainer = document.getElementById('sub-subfield');
let subSelectedSubfields = [];
const subInstitute = document.getElementById('sub-institute');
const subInstitutePills = document.getElementById('sub-institute-pills');
const subInstituteNewName = document.getElementById('sub-institute-new-name');
const subInstituteNewWebsite = document.getElementById('sub-institute-new-website');
const subInstituteNewFields = document.getElementById('sub-institute-new-fields');

// Multi-institute state
let selectedInstitutes = [];
let newInstituteData = {}; // { name: website } for proposed new institutes

// Auth elements
const subAuthForm = document.getElementById('submission-auth-form');
const subAuthStatus = document.getElementById('submission-auth-status');
const subAuthEmail = document.getElementById('sub-auth-email');
const subAuthPassword = document.getElementById('sub-auth-password');
const subAuthMessage = document.getElementById('sub-auth-message');
const subAuthUserEmail = document.getElementById('sub-auth-user-email');
const btnSubCreate = document.getElementById('btn-sub-create');
const btnSubLogin = document.getElementById('btn-sub-login');
const btnSubLogout = document.getElementById('btn-sub-logout');

export function initForm() {
  btnShowForm.addEventListener('click', () => {
    formWrapper.classList.remove('hidden');
    instFormWrapper.classList.add('hidden');
    btnShowForm.classList.add('hidden');
    btnShowInstForm.classList.add('hidden');
  });

  btnShowInstForm.addEventListener('click', () => {
    instFormWrapper.classList.remove('hidden');
    formWrapper.classList.add('hidden');
    btnShowForm.classList.add('hidden');
    btnShowInstForm.classList.add('hidden');
  });

  // Institute submission form
  instForm.addEventListener('submit', handleInstituteSubmit);
  btnInstSubCreate.addEventListener('click', () => handleInstSubAuth(true));
  btnInstSubLogin.addEventListener('click', () => handleInstSubAuth(false));
  btnInstSubLogout.addEventListener('click', async () => { try { await logout(); } catch (e) { console.error(e); } });

  btnAddLink.addEventListener('click', () => {
    addLinkRow(linksContainer);
  });

  form.addEventListener('submit', handleSubmit);

  // Subfield picker
  initSubfieldPicker(subSubfieldContainer, subSelectedSubfields, (updated) => { subSelectedSubfields = updated; });

  // Institute picker: add on select for existing, show fields for new
  subInstitute.addEventListener('change', () => {
    if (subInstitute.value === '__new__') {
      subInstituteNewFields.classList.remove('hidden');
      subInstituteNewName.focus();
    } else {
      subInstituteNewFields.classList.add('hidden');
      subInstituteNewName.value = '';
      subInstituteNewWebsite.value = '';
      handleAddInstitute();
    }
  });

  // "Add" button for proposed new institute
  document.getElementById('btn-add-new-institute').addEventListener('click', handleAddInstitute);

  // Auth buttons
  btnSubCreate.addEventListener('click', handleCreateAccount);
  btnSubLogin.addEventListener('click', handleLogin);
  btnSubLogout.addEventListener('click', handleSubLogout);

  document.getElementById('btn-sub-forgot').addEventListener('click', async () => {
    const email = subAuthEmail.value.trim();
    if (!email) {
      showAuthMsg('Please enter your email address first.', 'error');
      return;
    }
    try {
      await resetPassword(email);
      showAuthMsg('Password reset email sent. Check your inbox.', 'success');
    } catch (err) {
      showAuthMsg(err.message || 'Error sending reset email.', 'error');
    }
  });

  // Load institute options on init
  loadInstituteOptions();
}

export async function loadInstituteOptions() {
  try {
    const institutes = await fetchApprovedInstitutes();
    // Preserve selected value if possible
    const prev = subInstitute.value;
    // Clear all but first (placeholder) and last (propose new)
    subInstitute.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = 'Select institute...';
    subInstitute.appendChild(placeholder);

    institutes.forEach(inst => {
      const opt = document.createElement('option');
      opt.value = inst.name;
      opt.textContent = inst.name;
      subInstitute.appendChild(opt);
    });

    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = 'Propose new...';
    subInstitute.appendChild(newOpt);

    // Restore previous selection if still available
    if (prev && prev !== '__new__') {
      subInstitute.value = prev;
    }
  } catch (err) {
    console.error('Error loading institutes:', err);
  }
}

export function updateSubmissionAuthUI(user) {
  if (user) {
    subAuthForm.classList.add('hidden');
    subAuthStatus.classList.remove('hidden');
    subAuthUserEmail.textContent = user.email;
    showVerificationBanner(subAuthStatus, user);
  } else {
    subAuthForm.classList.remove('hidden');
    subAuthStatus.classList.add('hidden');
    subAuthUserEmail.textContent = '';
  }
  subAuthMessage.classList.add('hidden');

  // Also update institute submission auth
  if (user) {
    instSubAuthForm.classList.add('hidden');
    instSubAuthStatus.classList.remove('hidden');
    instSubAuthUserEmail.textContent = user.email;
    showVerificationBanner(instSubAuthStatus, user);
  } else {
    instSubAuthForm.classList.remove('hidden');
    instSubAuthStatus.classList.add('hidden');
    instSubAuthUserEmail.textContent = '';
  }
  instSubAuthMessage.classList.add('hidden');
}

function showVerificationBanner(container, user) {
  // Remove any existing banner
  const existing = container.querySelector('.verify-banner');
  if (existing) existing.remove();

  if (user && !user.emailVerified) {
    const banner = document.createElement('div');
    banner.className = 'verify-banner';
    banner.innerHTML = `
      <span>Please verify your email. Check your inbox for a confirmation link.</span>
      <button type="button" class="btn btn-sm btn-resend-verify">Resend email</button>
    `;
    banner.querySelector('.btn-resend-verify').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = 'Sending...';
      try {
        await resendVerification();
        btn.textContent = 'Sent!';
        setTimeout(() => { btn.textContent = 'Resend email'; btn.disabled = false; }, 3000);
      } catch (err) {
        btn.textContent = 'Error';
        setTimeout(() => { btn.textContent = 'Resend email'; btn.disabled = false; }, 3000);
      }
    });
    container.appendChild(banner);
  }
}

async function handleInstSubAuth(isCreate) {
  const email = instSubAuthEmail.value.trim();
  const password = instSubAuthPassword.value;
  instSubAuthMessage.classList.add('hidden');

  if (!email || !password) {
    showInstAuthMsg('Email and password are required.', 'error');
    return;
  }
  if (isCreate && password.length < 6) {
    showInstAuthMsg('Password must be at least 6 characters.', 'error');
    return;
  }

  btnInstSubCreate.disabled = true;
  btnInstSubLogin.disabled = true;
  try {
    if (isCreate) {
      await createAccount(email, password);
      showInstAuthMsg('Account created! A verification email has been sent. Please verify before submitting.', 'success');
    } else {
      await login(email, password);
    }
  } catch (err) {
    showInstAuthMsg(err.message || 'Authentication failed.', 'error');
  } finally {
    btnInstSubCreate.disabled = false;
    btnInstSubLogin.disabled = false;
  }
}

function showInstAuthMsg(text, type) {
  instSubAuthMessage.textContent = text;
  instSubAuthMessage.className = `form-message ${type}`;
  instSubAuthMessage.classList.remove('hidden');
}

async function handleInstituteSubmit(e) {
  e.preventDefault();
  hideMessage(instFormMessage);

  const user = getCurrentUser();
  if (!user) {
    showMessage(instFormMessage, 'Please create an account or log in before submitting.', 'error');
    return;
  }
  if (!isEmailVerified()) {
    showMessage(instFormMessage, 'Please verify your email before submitting. Check your inbox for a confirmation link.', 'error');
    return;
  }

  const name = instForm.elements.name.value.trim();
  const website = instForm.elements.website.value.trim();
  const keywordsRaw = instForm.elements.keywords.value.trim();
  const summary = instForm.elements.summary.value.trim();
  const logoURL = instForm.elements.logoURL.value.trim();

  if (!name) {
    showMessage(instFormMessage, 'Institute name is required.', 'error');
    return;
  }

  const keywords = keywordsRaw ? keywordsRaw.split(',').map(k => k.trim()).filter(Boolean) : [];

  const submitBtn = document.getElementById('btn-inst-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const isAdmin = getIsAdmin();
    await createInstitute(name, user.uid, { website, summary, keywords, logoURL, autoApprove: isAdmin });

    if (isAdmin) {
      showMessage(instFormMessage, 'Institute added successfully!', 'success');
      await loadPublicInstitutes();
    } else {
      showMessage(instFormMessage, 'Thank you! Your institute submission is pending review.', 'success');
    }

    instForm.reset();
    loadInstituteOptions();
  } catch (err) {
    console.error('Institute submission error:', err);
    showMessage(instFormMessage, 'Something went wrong. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit for Review';
  }
}

async function handleCreateAccount() {
  subAuthMessage.classList.add('hidden');
  const email = subAuthEmail.value.trim();
  const password = subAuthPassword.value;

  if (!email || !password) {
    showAuthMsg('Please enter email and password.', 'error');
    return;
  }
  if (password.length < 6) {
    showAuthMsg('Password must be at least 6 characters.', 'error');
    return;
  }

  btnSubCreate.disabled = true;
  btnSubLogin.disabled = true;
  try {
    await createAccount(email, password);
    showAuthMsg('Account created! A verification email has been sent. Please check your inbox and verify before submitting.', 'success');
  } catch (err) {
    showAuthMsg(err.message || 'Error creating account.', 'error');
  } finally {
    btnSubCreate.disabled = false;
    btnSubLogin.disabled = false;
  }
}

async function handleLogin() {
  subAuthMessage.classList.add('hidden');
  const email = subAuthEmail.value.trim();
  const password = subAuthPassword.value;

  if (!email || !password) {
    showAuthMsg('Please enter email and password.', 'error');
    return;
  }

  btnSubCreate.disabled = true;
  btnSubLogin.disabled = true;
  try {
    await login(email, password);
  } catch (err) {
    showAuthMsg(err.message || 'Login failed.', 'error');
  } finally {
    btnSubCreate.disabled = false;
    btnSubLogin.disabled = false;
  }
}

async function handleSubLogout() {
  try {
    await logout();
  } catch (err) {
    console.error('Logout error:', err);
  }
}

function showAuthMsg(text, type) {
  subAuthMessage.textContent = text;
  subAuthMessage.className = `form-message ${type}`;
  subAuthMessage.classList.remove('hidden');
}

function addLinkRow(container) {
  const row = document.createElement('div');
  row.className = 'link-row';
  row.innerHTML = `
    <input type="text" name="link-label" placeholder="Label (e.g. Website)">
    <input type="url" name="link-url" placeholder="https://...">
  `;
  container.appendChild(row);
}

function getSelectedSubfields() {
  return [...subSelectedSubfields];
}

function handleAddInstitute() {
  const value = subInstitute.value;
  if (value === '__new__') {
    const newName = subInstituteNewName.value.trim();
    const newWebsite = subInstituteNewWebsite.value.trim();
    if (!newName) return;
    if (selectedInstitutes.includes(newName)) return;
    selectedInstitutes.push(newName);
    newInstituteData[newName] = newWebsite;
    subInstituteNewName.value = '';
    subInstituteNewWebsite.value = '';
    subInstituteNewFields.classList.add('hidden');
  } else if (value && !selectedInstitutes.includes(value)) {
    selectedInstitutes.push(value);
  } else {
    return;
  }
  subInstitute.selectedIndex = 0;
  renderInstitutePills();
}

function renderInstitutePills() {
  subInstitutePills.innerHTML = selectedInstitutes.map(name =>
    `<span class="institute-pill">${escapeHTML(name)} <button type="button" class="institute-pill-remove" data-name="${escapeHTML(name)}">&times;</button></span>`
  ).join('');
  subInstitutePills.querySelectorAll('.institute-pill-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      selectedInstitutes = selectedInstitutes.filter(n => n !== name);
      delete newInstituteData[name];
      renderInstitutePills();
    });
  });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function handleSubmit(e) {
  e.preventDefault();
  hideMessage(formMessage);

  const user = getCurrentUser();
  if (!user) {
    showMessage(formMessage, 'Please create an account or log in before submitting.', 'error');
    return;
  }
  if (!isEmailVerified()) {
    showMessage(formMessage, 'Please verify your email before submitting. Check your inbox for a confirmation link.', 'error');
    return;
  }

  const name = form.elements.name.value.trim();
  const keywordsRaw = form.elements.keywords.value.trim();
  const summary = form.elements.summary.value.trim();
  const photoURL = form.elements.photoURL.value.trim();
  const submitterNote = form.elements.submitterNote.value.trim();
  const subfields = getSelectedSubfields();

  if (!name || !keywordsRaw || !summary) {
    showMessage(formMessage, 'Please fill in all required fields.', 'error');
    return;
  }

  if (subfields.length === 0) {
    showMessage(formMessage, 'Please select at least one subfield.', 'error');
    return;
  }

  if (selectedInstitutes.length === 0) {
    showMessage(formMessage, 'Please select at least one institute.', 'error');
    return;
  }

  const keywords = keywordsRaw.split(',').map(k => k.trim()).filter(Boolean);

  // Gather links
  const linkRows = linksContainer.querySelectorAll('.link-row');
  const links = [];
  linkRows.forEach(row => {
    const label = row.querySelector('[name="link-label"]').value.trim();
    const url = row.querySelector('[name="link-url"]').value.trim();
    if (label && url) links.push({ label, url });
  });

  const submitBtn = document.getElementById('btn-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const isAdmin = getIsAdmin();

    // Create any new institutes
    for (const instName of selectedInstitutes) {
      if (newInstituteData[instName] !== undefined) {
        await createInstitute(instName, user.uid, { website: newInstituteData[instName], autoApprove: isAdmin });
      }
    }

    if (isAdmin) {
      // Admin: create group directly, skip submission review
      await createGroup({
        name,
        keywords,
        summary,
        links,
        photoURL,
        subfields,
        subfield: subfields[0],
        institutes: selectedInstitutes,
        institute: selectedInstitutes[0] || '',
        creatorUid: user.uid
      });
      showMessage(formMessage, 'PI added successfully!', 'success');
      await loadGroups();
    } else {
      await createSubmission({
        name,
        keywords,
        summary,
        links,
        photoURL,
        subfields,
        subfield: subfields[0],
        institutes: selectedInstitutes,
        institute: selectedInstitutes[0] || '',
        submitterEmail: user.email,
        submitterNote,
        creatorUid: user.uid
      });
      showMessage(formMessage, 'Thank you! Your submission is pending review.', 'success');
    }

    form.reset();
    subInstituteNewFields.classList.add('hidden');
    subInstituteNewName.value = '';
    subInstituteNewWebsite.value = '';
    selectedInstitutes = [];
    newInstituteData = {};
    subSelectedSubfields = [];
    renderSubfieldPicker(subSubfieldContainer, subSelectedSubfields);
    renderInstitutePills();
    // Reset links to single row
    linksContainer.innerHTML = '';
    addLinkRow(linksContainer);
    // Refresh institute options in case a new one was proposed
    loadInstituteOptions();
  } catch (err) {
    console.error('Submission error:', err);
    showMessage(formMessage, 'Something went wrong. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit for Review';
  }
}

function showMessage(el, text, type) {
  el.textContent = text;
  el.className = `form-message ${type}`;
  el.classList.remove('hidden');
}

function hideMessage(el) {
  el.classList.add('hidden');
  el.textContent = '';
}

// ========== SHARED SUBFIELD PICKER ==========
export function initSubfieldPicker(container, selected, onUpdate) {
  container.querySelectorAll('.subfield-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const val = pill.dataset.value;
      const idx = selected.indexOf(val);
      if (idx >= 0) {
        selected.splice(idx, 1);
      } else {
        selected.push(val);
      }
      if (onUpdate) onUpdate(selected);
      renderSubfieldPicker(container, selected);
    });
  });
  renderSubfieldPicker(container, selected);
}

export function renderSubfieldPicker(container, selected) {
  container.querySelectorAll('.subfield-pill').forEach(pill => {
    const val = pill.dataset.value;
    const idx = selected.indexOf(val);
    if (idx >= 0) {
      pill.classList.add('selected');
      pill.innerHTML = `<span class="pill-order">${idx + 1}</span> ${pill.dataset.value.charAt(0).toUpperCase() + pill.dataset.value.slice(1)}`;
    } else {
      pill.classList.remove('selected');
      pill.textContent = pill.dataset.value.charAt(0).toUpperCase() + pill.dataset.value.slice(1);
    }
  });
}

export function setSubfieldPicker(container, selected, values) {
  selected.length = 0;
  values.forEach(v => { if (!selected.includes(v)) selected.push(v); });
  renderSubfieldPicker(container, selected);
}
