import { createSubmission, createGroup, fetchApprovedInstitutes, createInstitute } from './db.js';
import { getCurrentUser, getIsAdmin, createAccount, login, logout, resetPassword } from './auth.js';
import { loadGroups } from './ui-groups.js';

const form = document.getElementById('submission-form');
const formWrapper = document.getElementById('submission-form-wrapper');
const btnShowForm = document.getElementById('btn-show-form');
const formMessage = document.getElementById('form-message');
const linksContainer = document.getElementById('links-container');
const btnAddLink = document.getElementById('btn-add-link');

// Subfield checkboxes & institute
const subSubfieldContainer = document.getElementById('sub-subfield');
const subInstitute = document.getElementById('sub-institute');
const subInstitutePills = document.getElementById('sub-institute-pills');
const btnAddInstitute = document.getElementById('btn-add-institute');
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
    btnShowForm.classList.add('hidden');
  });

  btnAddLink.addEventListener('click', () => {
    addLinkRow(linksContainer);
  });

  form.addEventListener('submit', handleSubmit);

  // Institute picker: show/hide new institute fields
  subInstitute.addEventListener('change', () => {
    if (subInstitute.value === '__new__') {
      subInstituteNewFields.classList.remove('hidden');
      subInstituteNewName.focus();
    } else {
      subInstituteNewFields.classList.add('hidden');
      subInstituteNewName.value = '';
      subInstituteNewWebsite.value = '';
    }
  });

  // Multi-institute: add button
  btnAddInstitute.addEventListener('click', handleAddInstitute);

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
  } else {
    subAuthForm.classList.remove('hidden');
    subAuthStatus.classList.add('hidden');
    subAuthUserEmail.textContent = '';
  }
  subAuthMessage.classList.add('hidden');
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
    // onAuthChange will update the UI
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
  return [...subSubfieldContainer.querySelectorAll('input[name="subfield"]:checked')].map(cb => cb.value);
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
    showMessage(formMessage, 'Please add at least one institute using the + button.', 'error');
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
