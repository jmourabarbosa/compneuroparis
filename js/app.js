import { loadGroups, initSearch, initSections } from './ui-groups.js';
import { initForm, updateSubmissionAuthUI } from './ui-form.js';
import { onAuthChange, login, logout, resetPassword, authReady } from './auth.js';
import {
  initTabs, loadPending, loadManageGroups, loadAdmins,
  initSubmissionActions, initEditForm, initAddAdmin,
  showEditModalForCreator,
  loadPendingInstitutes, loadApprovedInstitutes
} from './ui-admin.js';

// ========== DOM REFS ==========
const btnAdminLogin = document.getElementById('btn-admin-login');
const adminBar = document.getElementById('admin-bar');
const adminEmail = document.getElementById('admin-email');
const btnAdminPanel = document.getElementById('btn-admin-panel');
const btnLogout = document.getElementById('btn-logout');
const modalLogin = document.getElementById('modal-login');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const modalAdmin = document.getElementById('modal-admin');

// Creator bar
const creatorBar = document.getElementById('creator-bar');
const creatorEmail = document.getElementById('creator-email');
const btnCreatorLogout = document.getElementById('btn-creator-logout');

// ========== MODAL HELPERS ==========
function openModal(modal) {
  modal.classList.remove('hidden');
  // Focus first input or close button
  const focusTarget = modal.querySelector('input, button');
  if (focusTarget) focusTarget.focus();
}

function closeModal(modal) {
  modal.classList.add('hidden');
}

// Close modals on overlay click or close button
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
});

document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.dataset.closeModal;
    closeModal(document.getElementById(modalId));
  });
});

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => closeModal(m));
  }
});

// ========== AUTH UI ==========
btnAdminLogin.addEventListener('click', () => openModal(modalLogin));

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMessage.classList.add('hidden');

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showLoginMsg('Please enter email and password.', 'error');
    return;
  }

  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    await login(email, password);
    closeModal(modalLogin);
    loginForm.reset();
  } catch (err) {
    showLoginMsg(err.message || 'Login failed.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

btnLogout.addEventListener('click', async () => {
  try {
    await logout();
  } catch (err) {
    console.error('Logout error:', err);
  }
});

btnCreatorLogout.addEventListener('click', async () => {
  try {
    await logout();
  } catch (err) {
    console.error('Logout error:', err);
  }
});

btnAdminPanel.addEventListener('click', () => {
  openModal(modalAdmin);
  loadPending();
  loadManageGroups();
  loadAdmins();
  loadPendingInstitutes();
  loadApprovedInstitutes();
});

document.getElementById('btn-login-forgot').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  if (!email) {
    showLoginMsg('Please enter your email address first.', 'error');
    return;
  }
  try {
    await resetPassword(email);
    showLoginMsg('Password reset email sent. Check your inbox.', 'success');
  } catch (err) {
    showLoginMsg(err.message || 'Error sending reset email.', 'error');
  }
});

function showLoginMsg(text, type) {
  loginMessage.textContent = text;
  loginMessage.className = `form-message ${type}`;
  loginMessage.classList.remove('hidden');
}

// ========== AUTH STATE (3 states: admin, creator, anon) ==========
onAuthChange((user, isAdmin) => {
  // Update submission auth UI
  updateSubmissionAuthUI(user);

  if (user && isAdmin) {
    // Admin state
    btnAdminLogin.classList.add('hidden');
    adminBar.classList.remove('hidden');
    creatorBar.classList.add('hidden');
    adminEmail.textContent = user.email;
  } else if (user) {
    // Creator state (logged in but not admin)
    btnAdminLogin.classList.add('hidden');
    adminBar.classList.add('hidden');
    creatorBar.classList.remove('hidden');
    creatorEmail.textContent = user.email;
    // Close admin modals if open
    closeModal(modalAdmin);
  } else {
    // Anonymous state
    btnAdminLogin.classList.remove('hidden');
    adminBar.classList.add('hidden');
    creatorBar.classList.add('hidden');
    adminEmail.textContent = '';
    creatorEmail.textContent = '';
    // Close admin modals if open
    closeModal(modalAdmin);
  }

  // Refresh groups to update edit buttons
  loadGroups();
});

// ========== CREATOR EDIT EVENT ==========
document.addEventListener('creator-edit-group', (e) => {
  showEditModalForCreator(e.detail);
});

// ========== INIT ==========
// Modules are deferred, so DOM is ready when this runs
initSearch();
initSections();
initForm();
initTabs();
initSubmissionActions();
initEditForm();
initAddAdmin();

// Load groups (public data)
loadGroups();
