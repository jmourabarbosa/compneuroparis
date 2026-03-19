import { loadGroups, initSearch, initSections, loadPublicInstitutes, loadPublicJobs, initPiDetail, initInstituteDetail, initJobDetail, handleDeepLink } from './ui-groups.js';
import { initForm, initJobForm, updateSubmissionAuthUI } from './ui-form.js';
import { onAuthChange, login, logout, resetPassword, createAccount, isEmailVerified, resendVerification, authReady } from './auth.js';
import {
  initTabs, loadPending, loadManageGroups, loadAdmins,
  initSubmissionActions, initEditForm, initAddAdmin,
  showEditModalForCreator,
  showEditInstituteModalForCreator, initEditInstituteForm,
  loadPendingInstitutes, loadApprovedInstitutes,
  loadPendingClaims, loadMessages,
  initEditUserForm, initSettings
} from './ui-admin.js';
import { fetchPendingSubmissions, fetchPendingClaims as dbFetchPendingClaims, fetchPendingInstitutes as dbFetchPendingInstitutes, fetchOpenReports, fetchOpenMessages as dbFetchOpenMessages } from './db.js';
import { initCreatorPanel } from './ui-creator.js';

// ========== DOM REFS ==========
const btnAdminLogin = document.getElementById('btn-admin-login');
const adminBar = document.getElementById('admin-bar');
const adminEmail = document.getElementById('admin-email');
const btnAdminPanel = document.getElementById('btn-admin-panel');
const btnAdminPanelBeta = document.getElementById('btn-admin-panel-beta');
const btnLogout = document.getElementById('btn-logout');
const modalLogin = document.getElementById('modal-login');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const modalAdmin = document.getElementById('modal-admin');

// Global verification banner
const globalVerifyBanner = document.getElementById('global-verify-banner');
const btnGlobalResend = document.getElementById('btn-global-resend');

// Sign up
const btnSignup = document.getElementById('btn-signup');
const modalSignup = document.getElementById('modal-signup');
const signupForm = document.getElementById('signup-form');
const signupMessage = document.getElementById('signup-message');

// Creator bar
const creatorBar = document.getElementById('creator-bar');
const creatorEmail = document.getElementById('creator-email');
const btnCreatorLogout = document.getElementById('btn-creator-logout');
const isAdminWorkspace = document.body.classList.contains('admin-page');
const adminPageStatus = document.getElementById('admin-page-status');

function openAdminWorkspace() {
  openModal(modalAdmin);
  loadPending();
  loadManageGroups();
  loadPendingClaims();
  loadAdmins();
  loadPendingInstitutes();
  loadApprovedInstitutes();
  updateAdminBadge();
}

// ========== MODAL HELPERS ==========
function openModal(modal) {
  modal.classList.remove('hidden');
  // Focus first input or close button
  const focusTarget = modal.querySelector('input, button');
  if (focusTarget) focusTarget.focus();
}

function closeModal(modal) {
  if (isAdminWorkspace && modal.id === 'modal-admin') return;
  modal.classList.add('hidden');
  if (modal.id === 'modal-admin') updateAdminBadge();
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
  openAdminWorkspace();
});

if (btnAdminPanelBeta) {
  btnAdminPanelBeta.addEventListener('click', () => {
    window.location.href = 'admin.html';
  });
}

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

// ========== SIGN UP UI ==========
btnSignup.addEventListener('click', () => openModal(modalSignup));

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  signupMessage.classList.add('hidden');

  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  if (!email || !password) {
    showSignupMsg('Please enter email and password.', 'error');
    return;
  }
  if (password.length < 6) {
    showSignupMsg('Password must be at least 6 characters.', 'error');
    return;
  }

  const submitBtn = signupForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    await createAccount(email, password);
    // Show verification banner inside the signup modal
    signupMessage.innerHTML = `
      <span>Account created! Please verify your email. Check your spam inbox for a confirmation link.</span>
    `;
    signupMessage.className = 'verify-banner';
    signupMessage.classList.remove('hidden');
  } catch (err) {
    showSignupMsg(err.message || 'Error creating account.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById('btn-signup-to-login').addEventListener('click', () => {
  closeModal(modalSignup);
  signupForm.reset();
  signupMessage.classList.add('hidden');
  openModal(modalLogin);
});

function showSignupMsg(text, type) {
  signupMessage.textContent = text;
  signupMessage.className = `form-message ${type}`;
  signupMessage.classList.remove('hidden');
}

function showLoginMsg(text, type) {
  loginMessage.textContent = text;
  loginMessage.className = `form-message ${type}`;
  loginMessage.classList.remove('hidden');
}

// ========== GLOBAL VERIFY BANNER ==========
btnGlobalResend.addEventListener('click', async () => {
  btnGlobalResend.disabled = true;
  btnGlobalResend.textContent = 'Sending...';
  try {
    await resendVerification();
    btnGlobalResend.textContent = 'Sent!';
    setTimeout(() => { btnGlobalResend.textContent = 'Resend email'; btnGlobalResend.disabled = false; }, 3000);
  } catch (err) {
    btnGlobalResend.textContent = 'Error';
    setTimeout(() => { btnGlobalResend.textContent = 'Resend email'; btnGlobalResend.disabled = false; }, 3000);
  }
});

function updateGlobalVerifyBanner(user) {
  if (user && !user.emailVerified) {
    globalVerifyBanner.classList.remove('hidden');
  } else {
    globalVerifyBanner.classList.add('hidden');
  }
}

// ========== AUTH STATE (3 states: admin, creator, anon) ==========
async function updateAdminBadge() {
  const badge = document.getElementById('admin-badge');
  try {
    const safe = (p) => p.catch(() => []);
    const [submissions, claims, institutes, reports, messages] = await Promise.all([
      safe(fetchPendingSubmissions()),
      safe(dbFetchPendingClaims()),
      safe(dbFetchPendingInstitutes()),
      safe(fetchOpenReports()),
      safe(dbFetchOpenMessages())
    ]);
    const total = submissions.length + claims.length + institutes.length + reports.length + messages.length;
    if (total > 0) {
      badge.textContent = total;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    // Per-tab badges inside admin panel
    setTabBadge('tab-pending', submissions.length);
    setTabBadge('tab-claims', claims.length);
    setTabBadge('tab-institutes', institutes.length);
    setTabBadge('tab-reports', reports.length);
    setTabBadge('tab-messages', messages.length);
  } catch (e) {
    badge.classList.add('hidden');
  }
}

function setTabBadge(tabId, count) {
  const tab = document.querySelector(`.tab[data-tab="${tabId}"]`);
  if (!tab) return;
  let badge = tab.querySelector('.tab-badge');
  if (count > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'tab-badge';
      tab.appendChild(badge);
    }
    badge.textContent = count;
  } else if (badge) {
    badge.remove();
  }
}

onAuthChange((user, isAdmin) => {
  // Update submission auth UI
  updateSubmissionAuthUI(user);
  updateGlobalVerifyBanner(user);

  if (user && isAdmin) {
    // Admin state
    btnAdminLogin.classList.add('hidden');
    btnSignup.classList.add('hidden');
    adminBar.classList.remove('hidden');
    creatorBar.classList.add('hidden');
    adminEmail.textContent = user.email;
    closeModal(modalSignup);
    updateAdminBadge();
    if (isAdminWorkspace) {
      if (adminPageStatus) adminPageStatus.textContent = 'You are logged in as an admin. The full workspace is available below.';
      openAdminWorkspace();
    }
  } else if (user) {
    // Creator state (logged in but not admin)
    btnAdminLogin.classList.add('hidden');
    btnSignup.classList.add('hidden');
    adminBar.classList.add('hidden');
    creatorBar.classList.remove('hidden');
    creatorEmail.textContent = user.email;
    // Close admin modals if open
    closeModal(modalAdmin);
    closeModal(modalSignup);
    if (isAdminWorkspace && adminPageStatus) {
      adminPageStatus.textContent = 'This page requires admin access. You are logged in, but this account is not an admin.';
    }
  } else {
    // Anonymous state
    btnAdminLogin.classList.remove('hidden');
    btnSignup.classList.remove('hidden');
    adminBar.classList.add('hidden');
    creatorBar.classList.add('hidden');
    adminEmail.textContent = '';
    creatorEmail.textContent = '';
    // Close admin modals if open
    closeModal(modalAdmin);
    if (isAdminWorkspace && adminPageStatus) {
      adminPageStatus.textContent = 'Log in with an admin account to access the full admin workspace.';
    }
  }

  // Refresh groups to update edit buttons
  loadGroups();
});

// ========== CREATOR EDIT EVENTS ==========
document.addEventListener('creator-edit-group', (e) => {
  showEditModalForCreator(e.detail);
});

document.addEventListener('creator-edit-institute', (e) => {
  showEditInstituteModalForCreator(e.detail);
});

document.addEventListener('admin-data-changed', () => {
  updateAdminBadge();
});

// ========== INIT ==========
// Modules are deferred, so DOM is ready when this runs
initSearch();
initSections();
initForm();
initTabs();
initSubmissionActions();
initEditForm();
initEditInstituteForm();
initAddAdmin();
initEditUserForm();
initSettings();
initPiDetail();
initInstituteDetail();
initJobDetail();
initJobForm();
initCreatorPanel();

// Load jobs first (needed for Hiring badges on PI cards), then groups + institutes, then deep links
loadPublicJobs()
  .then(() => Promise.all([loadGroups(), loadPublicInstitutes()]))
  .then(() => handleDeepLink());

// Handle #admin deep link (wait for auth to resolve)
authReady.then(() => {
  if (isAdminWorkspace && !adminBar.classList.contains('hidden')) {
    openAdminWorkspace();
  } else if (window.location.hash === '#admin') {
    // Only open if user is already logged in as admin
    if (!adminBar.classList.contains('hidden')) {
      btnAdminPanel.click();
    }
  }
});
