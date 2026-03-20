import { createSubmission, createGroup, fetchApprovedInstitutes, createInstitute, createMessage, fetchGroupsClaimedBy, createJob, fetchGroups } from './db.js';
import { getCurrentUser, getIsAdmin, createAccount, login, logout, resetPassword, isEmailVerified, resendVerification, getAuthErrorMessage } from './auth.js';
import { loadGroups, loadPublicInstitutes, loadPublicJobs } from './ui-groups.js';
import { getImageUrlValidationMessage, validateImageUrl } from './image-url-utils.mjs';
import { buildInstituteFieldData } from './institute-links.mjs';
import { getPreferredUserName } from './manager-name-utils.mjs';

const form = document.getElementById('submission-form');
const formWrapper = document.getElementById('submission-form-wrapper');
const btnShowForm = document.getElementById('btn-show-form');
const formMessage = document.getElementById('form-message');
const submissionDuplicateWarning = document.getElementById('submission-duplicate-warning');
const linksContainer = document.getElementById('links-container');
const btnAddLink = document.getElementById('btn-add-link');
const subNameInput = document.getElementById('sub-name');

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
const instSubRemember = document.getElementById('inst-sub-remember');
const btnInstSubCreate = document.getElementById('btn-inst-sub-create');
const btnInstSubLogin = document.getElementById('btn-inst-sub-login');
const btnInstSubLogout = document.getElementById('btn-inst-sub-logout');

// Subfield dropdown + checkboxes
const subPrimarySubfield = document.getElementById('sub-primary-subfield');
const subInstitute = document.getElementById('sub-institute');
const subInstitutePills = document.getElementById('sub-institute-pills');
const subInstituteNewName = document.getElementById('sub-institute-new-name');
const subInstituteNewWebsite = document.getElementById('sub-institute-new-website');
const subInstituteNewFields = document.getElementById('sub-institute-new-fields');

// Multi-institute state
let selectedInstitutes = [];
let cachedExistingGroups = [];

// Auth elements
const subAuthForm = document.getElementById('submission-auth-form');
const subAuthStatus = document.getElementById('submission-auth-status');
const subAuthEmail = document.getElementById('sub-auth-email');
const subAuthPassword = document.getElementById('sub-auth-password');
const subAuthMessage = document.getElementById('sub-auth-message');
const subAuthUserEmail = document.getElementById('sub-auth-user-email');
const subRemember = document.getElementById('sub-remember');
const btnSubCreate = document.getElementById('btn-sub-create');
const btnSubLogin = document.getElementById('btn-sub-login');
const btnSubLogout = document.getElementById('btn-sub-logout');

export function initForm() {
  const contactFormWrapper = document.getElementById('contact-form-wrapper');
  const btnShowContact = document.getElementById('btn-show-contact');
  const jobFormWrapper = document.getElementById('job-form-wrapper');
  const btnShowJobForm = document.getElementById('btn-show-job-form');

  function showAllButtons() {
    btnShowForm.classList.remove('hidden');
    btnShowInstForm.classList.remove('hidden');
    btnShowContact.classList.remove('hidden');
    btnShowJobForm.classList.remove('hidden');
    formWrapper.classList.add('hidden');
    instFormWrapper.classList.add('hidden');
    contactFormWrapper.classList.add('hidden');
    jobFormWrapper.classList.add('hidden');
  }

  function hideAllForms() {
    formWrapper.classList.add('hidden');
    instFormWrapper.classList.add('hidden');
    contactFormWrapper.classList.add('hidden');
    jobFormWrapper.classList.add('hidden');
    btnShowForm.classList.add('hidden');
    btnShowInstForm.classList.add('hidden');
    btnShowContact.classList.add('hidden');
    btnShowJobForm.classList.add('hidden');
  }

  btnShowForm.addEventListener('click', () => {
    hideAllForms();
    formWrapper.classList.remove('hidden');
  });

  btnShowInstForm.addEventListener('click', () => {
    hideAllForms();
    instFormWrapper.classList.remove('hidden');
  });

  btnShowContact.addEventListener('click', () => {
    hideAllForms();
    contactFormWrapper.classList.remove('hidden');
  });

  btnShowJobForm.addEventListener('click', () => {
    hideAllForms();
    jobFormWrapper.classList.remove('hidden');
    populateJobPiSelector();
  });

  // Cancel buttons
  document.getElementById('btn-cancel-form').addEventListener('click', showAllButtons);
  document.getElementById('btn-cancel-institute-form').addEventListener('click', showAllButtons);
  document.getElementById('btn-cancel-job-form').addEventListener('click', showAllButtons);
  document.getElementById('btn-cancel-contact').addEventListener('click', showAllButtons);

  // Contact form
  document.getElementById('contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('contact-email').value.trim();
    const message = document.getElementById('contact-message').value.trim();
    const msgEl = document.getElementById('contact-form-message');
    const btn = document.getElementById('btn-contact-submit');

    if (!email || !message) {
      msgEl.textContent = 'Please fill in all fields.';
      msgEl.className = 'form-message error';
      msgEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending...';
    try {
      await createMessage({ email, message });
      msgEl.textContent = 'Message sent! Thank you.';
      msgEl.className = 'form-message success';
      msgEl.classList.remove('hidden');
      document.getElementById('contact-form').reset();
    } catch (err) {
      console.error('Contact form error:', err);
      msgEl.textContent = 'Error sending message. Please try again.';
      msgEl.className = 'form-message error';
      msgEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Message';
    }
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
  subNameInput.addEventListener('input', () => {
    void updateDuplicatePiWarning(subNameInput.value);
  });
  void preloadExistingGroups();

  // Auto-disable primary subfield in secondary checkboxes
  subPrimarySubfield.addEventListener('change', () => {
    syncSecondaryCheckboxes(subPrimarySubfield, 'sub-secondary');
  });

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
    showAuthMsg(getAuthErrorMessage(err, 'Error sending reset email.'), 'error');
  }
});

  // Load institute options on init
  loadInstituteOptions();
}

async function preloadExistingGroups() {
  try {
    cachedExistingGroups = await fetchGroups();
    await updateDuplicatePiWarning(subNameInput.value);
  } catch (err) {
    console.error('Error loading groups for duplicate detection:', err);
  }
}

function normalizeName(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeName(value) {
  return normalizeName(value).split(' ').filter(Boolean);
}

function findPotentialDuplicateGroups(name) {
  const normalizedName = normalizeName(name);
  const nameTokens = tokenizeName(name);
  if (!normalizedName || nameTokens.length === 0) return [];

  return cachedExistingGroups.filter(group => {
    const groupNormalizedName = normalizeName(group.name);
    const groupTokens = tokenizeName(group.name);
    if (!groupNormalizedName) return false;
    if (groupNormalizedName === normalizedName) return true;
    if (groupNormalizedName.includes(normalizedName) || normalizedName.includes(groupNormalizedName)) return true;
    const overlapCount = nameTokens.filter(token => groupTokens.includes(token)).length;
    return overlapCount >= Math.min(2, nameTokens.length, groupTokens.length);
  });
}

async function updateDuplicatePiWarning(name) {
  if (!submissionDuplicateWarning) return;

  const matches = findPotentialDuplicateGroups(name).slice(0, 3);
  if (matches.length === 0) {
    submissionDuplicateWarning.classList.add('hidden');
    submissionDuplicateWarning.textContent = '';
    return;
  }

  const label = matches.map(group => group.name).join(', ');
  submissionDuplicateWarning.textContent = `A similar PI page already exists (${label}). If this is your page, please search for it and use the claim flow instead of creating a new one.`;
  submissionDuplicateWarning.className = 'form-message info';
  submissionDuplicateWarning.classList.remove('hidden');
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
    placeholder.textContent = 'Select institution...';
    subInstitute.appendChild(placeholder);

    institutes.forEach(inst => {
      const opt = document.createElement('option');
      opt.value = inst.id;
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
  const rememberMe = !!instSubRemember?.checked;
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
      await createAccount(email, password, { rememberMe });
      showInstAuthMsg('Account created! A verification email has been sent. Please verify before submitting.', 'success');
    } else {
      await login(email, password, { rememberMe });
    }
  } catch (err) {
    showInstAuthMsg(getAuthErrorMessage(err, 'Authentication failed.'), 'error');
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
    showMessage(instFormMessage, 'Institution name is required.', 'error');
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
      showMessage(instFormMessage, 'Institution added successfully!', 'success');
      await loadPublicInstitutes();
    } else {
      showMessage(instFormMessage, 'Thank you! Your institution submission is pending review.', 'success');
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
  const rememberMe = !!subRemember?.checked;

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
    await createAccount(email, password, { rememberMe });
    showAuthMsg('Account created! A verification email has been sent. Please check your inbox and verify before submitting.', 'success');
  } catch (err) {
    showAuthMsg(getAuthErrorMessage(err, 'Error creating account.'), 'error');
  } finally {
    btnSubCreate.disabled = false;
    btnSubLogin.disabled = false;
  }
}

async function handleLogin() {
  subAuthMessage.classList.add('hidden');
  const email = subAuthEmail.value.trim();
  const password = subAuthPassword.value;
  const rememberMe = !!subRemember?.checked;

  if (!email || !password) {
    showAuthMsg('Please enter email and password.', 'error');
    return;
  }

  btnSubCreate.disabled = true;
  btnSubLogin.disabled = true;
  try {
    await login(email, password, { rememberMe });
  } catch (err) {
    showAuthMsg(getAuthErrorMessage(err, 'Login failed.'), 'error');
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
  return getSubfieldsFromPicker(subPrimarySubfield, 'sub-secondary');
}

function handleAddInstitute() {
  const value = subInstitute.value;
  if (value === '__new__') {
    const newName = subInstituteNewName.value.trim();
    const newWebsite = subInstituteNewWebsite.value.trim();
    if (!newName) return;
    if (selectedInstitutes.some(inst => inst.name === newName)) return;
    selectedInstitutes.push({ id: '', name: newName, website: newWebsite });
    subInstituteNewName.value = '';
    subInstituteNewWebsite.value = '';
    subInstituteNewFields.classList.add('hidden');
  } else if (value && !selectedInstitutes.some(inst => inst.id === value)) {
    const selectedOption = subInstitute.options[subInstitute.selectedIndex];
    selectedInstitutes.push({ id: value, name: selectedOption?.textContent || value });
  } else {
    return;
  }
  subInstitute.selectedIndex = 0;
  renderInstitutePills();
}

function renderInstitutePills() {
  subInstitutePills.innerHTML = selectedInstitutes.map(inst =>
    `<span class="institute-pill">${escapeHTML(inst.name)} <button type="button" class="institute-pill-remove" data-key="${escapeHTML(inst.id || inst.name)}">&times;</button></span>`
  ).join('');
  subInstitutePills.querySelectorAll('.institute-pill-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      selectedInstitutes = selectedInstitutes.filter(inst => (inst.id || inst.name) !== key);
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
  const photoInputValue = form.elements.photoURL.value.trim();
  const submitterNote = form.elements.submitterNote.value.trim();
  const subfields = getSelectedSubfields();

  if (!name || !keywordsRaw || !summary) {
    showMessage(formMessage, 'Please fill in all required fields.', 'error');
    return;
  }

  if (!photoInputValue) {
    showMessage(formMessage, 'Please add a photo URL for the PI before submitting.', 'error');
    return;
  }

  if (subfields.length === 0) {
    showMessage(formMessage, 'Please select at least one subfield.', 'error');
    return;
  }

  if (selectedInstitutes.length === 0) {
    showMessage(formMessage, 'Please select at least one institution.', 'error');
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

  const photoValidation = await validateImageUrl(photoInputValue);
  if (!photoValidation.valid) {
    showMessage(formMessage, getImageUrlValidationMessage(photoValidation, 'PI photo URL'), 'error');
    return;
  }

  const submitBtn = document.getElementById('btn-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const photoURL = photoInputValue;
    const isAdmin = getIsAdmin();

    const resolvedInstitutes = [];
    for (const instituteRef of selectedInstitutes) {
      if (instituteRef.id) {
        resolvedInstitutes.push({ id: instituteRef.id, name: instituteRef.name });
        continue;
      }

      const createdInstituteId = await createInstitute(instituteRef.name, user.uid, {
        website: instituteRef.website || '',
        autoApprove: isAdmin
      });
      resolvedInstitutes.push({ id: createdInstituteId, name: instituteRef.name });
    }

    const instituteFieldData = buildInstituteFieldData(resolvedInstitutes);

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
        ...instituteFieldData,
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
        ...instituteFieldData,
        submitterEmail: user.email,
        submitterName: getPreferredUserName(user),
        submitterNote,
        creatorUid: user.uid
      });
      showMessage(formMessage, 'Thank you! Your submission is pending review.', 'success');
    }

    form.reset();
    submissionDuplicateWarning.classList.add('hidden');
    submissionDuplicateWarning.textContent = '';
    subInstituteNewFields.classList.add('hidden');
    subInstituteNewName.value = '';
    subInstituteNewWebsite.value = '';
    selectedInstitutes = [];
    subPrimarySubfield.selectedIndex = 0;
    document.querySelectorAll('input[name="sub-secondary"]').forEach(cb => { cb.checked = false; cb.disabled = false; });
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

// ========== SHARED SUBFIELD HELPERS ==========
// Build ordered subfields array: primary first, then checked secondaries
export function getSubfieldsFromPicker(primarySelect, secondaryName) {
  const primary = primarySelect.value;
  const secondaries = [...document.querySelectorAll(`input[name="${secondaryName}"]:checked`)]
    .map(cb => cb.value)
    .filter(v => v !== primary);
  if (!primary) return secondaries;
  return [primary, ...secondaries];
}

// Populate a dropdown + checkboxes from an existing subfields array
export function setSubfieldDropdown(primarySelect, secondaryName, subfields) {
  const primary = subfields[0] || '';
  primarySelect.value = primary;
  const rest = subfields.slice(1);
  document.querySelectorAll(`input[name="${secondaryName}"]`).forEach(cb => {
    cb.checked = rest.includes(cb.value);
    cb.disabled = cb.value === primary;
  });
}

// Disable the primary value in secondary checkboxes and uncheck it
export function syncSecondaryCheckboxes(primarySelect, secondaryName) {
  const primary = primarySelect.value;
  document.querySelectorAll(`input[name="${secondaryName}"]`).forEach(cb => {
    if (cb.value === primary) {
      cb.checked = false;
      cb.disabled = true;
    } else {
      cb.disabled = false;
    }
  });
}

// ========== JOB FORM ==========

const jobForm = document.getElementById('job-form');
const jobPiSelect = document.getElementById('job-pi-select');
const jobFormMessage = document.getElementById('job-form-message');
const jobFormAuthWarning = document.getElementById('job-form-auth-warning');

async function populateJobPiSelector() {
  const user = getCurrentUser();
  jobFormAuthWarning.classList.add('hidden');
  jobPiSelect.innerHTML = '<option value="" disabled selected>Select a PI you manage...</option>';

  if (!user) {
    jobFormAuthWarning.textContent = 'Please log in to post a job ad.';
    jobFormAuthWarning.classList.remove('hidden');
    document.getElementById('btn-job-submit').disabled = true;
    return;
  }

  if (!isEmailVerified()) {
    jobFormAuthWarning.textContent = 'Please verify your email before posting a job ad.';
    jobFormAuthWarning.classList.remove('hidden');
    document.getElementById('btn-job-submit').disabled = true;
    return;
  }

  try {
    const claimedPIs = await fetchGroupsClaimedBy(user.uid);
    if (claimedPIs.length === 0) {
      jobFormAuthWarning.textContent = 'You must claim a PI page before posting a job ad.';
      jobFormAuthWarning.classList.remove('hidden');
      document.getElementById('btn-job-submit').disabled = true;
      return;
    }

    claimedPIs.forEach(pi => {
      const opt = document.createElement('option');
      opt.value = pi.id;
      opt.textContent = pi.name;
      opt.dataset.piName = pi.name;
      jobPiSelect.appendChild(opt);
    });
    document.getElementById('btn-job-submit').disabled = false;
  } catch (err) {
    console.error('Error loading claimed PIs:', err);
    jobFormAuthWarning.textContent = 'Error loading your claimed PIs.';
    jobFormAuthWarning.classList.remove('hidden');
    document.getElementById('btn-job-submit').disabled = true;
  }
}

export function initJobForm() {
  jobForm.addEventListener('submit', handleJobSubmit);
}

async function handleJobSubmit(e) {
  e.preventDefault();
  hideMessage(jobFormMessage);

  const user = getCurrentUser();
  if (!user) {
    showMessage(jobFormMessage, 'Please log in to post a job ad.', 'error');
    return;
  }
  if (!isEmailVerified()) {
    showMessage(jobFormMessage, 'Please verify your email before posting.', 'error');
    return;
  }

  const piId = jobPiSelect.value;
  const piOption = jobPiSelect.selectedOptions[0];
  const piName = piOption?.dataset?.piName || piOption?.textContent || '';
  const positionType = document.getElementById('job-position-type').value;
  const title = document.getElementById('job-title').value.trim();
  const description = document.getElementById('job-description').value.trim();
  const keywordsRaw = document.getElementById('job-keywords').value.trim();
  const keywords = keywordsRaw ? keywordsRaw.split(',').map(k => k.trim()).filter(Boolean) : [];
  let link = document.getElementById('job-link').value.trim();

  if (!piId || !positionType || !title) {
    showMessage(jobFormMessage, 'Please fill in all required fields.', 'error');
    return;
  }

  // Ensure link has a protocol
  if (link && !/^https?:\/\//i.test(link)) {
    link = 'https://' + link;
  }

  const submitBtn = document.getElementById('btn-job-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Posting...';

  try {
    await createJob({
      piId,
      piName,
      positionType,
      title,
      description,
      keywords,
      link,
      postedBy: user.uid,
      postedByEmail: user.email
    });
    showMessage(jobFormMessage, 'Job posted successfully!', 'success');
    jobForm.reset();
    await loadPublicJobs();
  } catch (err) {
    console.error('Job submission error:', err);
    showMessage(jobFormMessage, 'Error posting job. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Post Job';
  }
}
