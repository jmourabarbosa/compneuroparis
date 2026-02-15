import { createSubmission } from './db.js';
import { getCurrentUser, createAccount, login, logout } from './auth.js';

const form = document.getElementById('submission-form');
const formWrapper = document.getElementById('submission-form-wrapper');
const btnShowForm = document.getElementById('btn-show-form');
const formMessage = document.getElementById('form-message');
const linksContainer = document.getElementById('links-container');
const btnAddLink = document.getElementById('btn-add-link');

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

  // Auth buttons
  btnSubCreate.addEventListener('click', handleCreateAccount);
  btnSubLogin.addEventListener('click', handleLogin);
  btnSubLogout.addEventListener('click', handleSubLogout);
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

  if (!name || !keywordsRaw || !summary) {
    showMessage(formMessage, 'Please fill in all required fields.', 'error');
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
    await createSubmission({
      name,
      keywords,
      summary,
      links,
      photoURL,
      submitterEmail: user.email,
      submitterNote,
      creatorUid: user.uid
    });

    showMessage(formMessage, 'Thank you! Your submission is pending review.', 'success');
    form.reset();
    // Reset links to single row
    linksContainer.innerHTML = '';
    addLinkRow(linksContainer);
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
