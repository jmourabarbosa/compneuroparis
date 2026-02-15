import { fetchGroups, fetchApprovedInstitutes, createClaim, fetchMyClaimForTarget } from './db.js';
import { getCurrentUser, getIsAdmin, createAccount, login } from './auth.js';

let allGroups = [];
let allInstitutes = [];
let activeKeyword = null;
let searchText = '';
let activeInstitute = null;

const SUBFIELDS = ['computational', 'systems', 'human'];

// Section refs
const sections = {};
SUBFIELDS.forEach(sf => {
  const section = document.querySelector(`.subfield-section[data-subfield="${sf}"]`);
  sections[sf] = {
    el: section,
    grid: section.querySelector('.groups-grid'),
    count: section.querySelector('.subfield-count'),
    header: section.querySelector('.subfield-header')
  };
});

const groupsLoading = document.getElementById('groups-loading');
const groupsEmpty = document.getElementById('groups-empty');
const searchInput = document.getElementById('search-input');
const keywordFilters = document.getElementById('keyword-filters');
const instituteFilterBanner = document.getElementById('institute-filter-banner');
const instituteFilterName = document.getElementById('institute-filter-name');
const instituteFilterClear = document.getElementById('institute-filter-clear');

// PI Detail modal refs
const modalPiDetail = document.getElementById('modal-pi-detail');
const piDetailTitle = document.getElementById('pi-detail-title');
const piDetailPhoto = document.getElementById('pi-detail-photo');
const piDetailInstitute = document.getElementById('pi-detail-institute');
const piDetailSubfield = document.getElementById('pi-detail-subfield');
const piDetailKeywords = document.getElementById('pi-detail-keywords');
const piDetailSummary = document.getElementById('pi-detail-summary');
const piDetailLinks = document.getElementById('pi-detail-links');
const piDetailClaimSection = document.getElementById('pi-detail-claim-section');
const piDetailClaimPending = document.getElementById('pi-detail-claim-pending');
const piDetailClaimed = document.getElementById('pi-detail-claimed');
const btnClaimPi = document.getElementById('btn-claim-pi');
const piDetailEditSection = document.getElementById('pi-detail-edit-section');
const btnPiDetailEdit = document.getElementById('btn-pi-detail-edit');

let currentDetailGroup = null;

// Institute Detail modal refs
const modalInstDetail = document.getElementById('modal-institute-detail');
const instDetailTitle = document.getElementById('inst-detail-title');
const instDetailLogo = document.getElementById('inst-detail-logo');
const instDetailWebsite = document.getElementById('inst-detail-website');
const instDetailKeywords = document.getElementById('inst-detail-keywords');
const instDetailSummary = document.getElementById('inst-detail-summary');
const instDetailLinks = document.getElementById('inst-detail-links');
const instDetailEditSection = document.getElementById('inst-detail-edit-section');
const instDetailClaimSection = document.getElementById('inst-detail-claim-section');
const instDetailClaimPending = document.getElementById('inst-detail-claim-pending');
const instDetailClaimed = document.getElementById('inst-detail-claimed');
const btnClaimInst = document.getElementById('btn-claim-inst');
const btnInstDetailEdit = document.getElementById('btn-inst-detail-edit');
const btnInstViewPis = document.getElementById('btn-inst-view-pis');

let currentDetailInstitute = null;

// Generic claim target: { id, name, type }
let currentClaimTarget = null;

export async function loadGroups() {
  groupsLoading.classList.remove('hidden');
  groupsEmpty.classList.add('hidden');
  SUBFIELDS.forEach(sf => { sections[sf].grid.innerHTML = ''; });

  try {
    allGroups = await fetchGroups();
  } catch (err) {
    console.error('Error loading groups:', err);
    allGroups = [];
  }

  groupsLoading.classList.add('hidden');
  buildKeywordFilters();
  renderGroups();
}

function buildKeywordFilters() {
  const keywords = new Set();
  allGroups.forEach(g => {
    (g.keywords || []).forEach(k => keywords.add(k.trim().toLowerCase()));
  });

  keywordFilters.innerHTML = '';
  const sorted = [...keywords].sort();
  sorted.forEach(kw => {
    const btn = document.createElement('button');
    btn.className = 'keyword-btn';
    btn.textContent = kw;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => toggleKeyword(kw, btn));
    keywordFilters.appendChild(btn);
  });
  keywordFilters.classList.toggle('hidden', searchText.length === 0 && !activeKeyword);
}

function toggleKeyword(kw, btn) {
  if (activeKeyword === kw) {
    activeKeyword = null;
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
  } else {
    // Deactivate previous
    keywordFilters.querySelectorAll('.keyword-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    activeKeyword = kw;
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
  }
  renderGroups();
}

export function filterGroups() {
  searchText = searchInput.value.trim().toLowerCase();
  keywordFilters.classList.toggle('hidden', searchText.length === 0 && !activeKeyword);
  renderGroups();
  renderInstitutes();
}

function renderGroups() {
  const filtered = allGroups.filter(g => {
    // Institute filter
    if (activeInstitute) {
      if ((g.institute || '') !== activeInstitute) return false;
    }
    // Keyword filter
    if (activeKeyword) {
      const kws = (g.keywords || []).map(k => k.trim().toLowerCase());
      if (!kws.includes(activeKeyword)) return false;
    }
    // Text search
    if (searchText) {
      const haystack = [
        g.name,
        g.summary,
        ...(g.keywords || [])
      ].join(' ').toLowerCase();
      if (!haystack.includes(searchText)) return false;
    }
    return true;
  });

  // Partition by subfield (default to "computational" if missing)
  const bySubfield = { computational: [], systems: [], human: [] };
  filtered.forEach(g => {
    const sf = bySubfield[g.subfield] ? g.subfield : 'computational';
    bySubfield[sf].push(g);
  });

  let totalVisible = 0;

  const isSearching = searchText || activeKeyword || activeInstitute;

  SUBFIELDS.forEach(sf => {
    const { grid, count, el } = sections[sf];
    grid.innerHTML = '';
    const groups = bySubfield[sf];
    count.textContent = groups.length;

    if (isSearching && groups.length === 0) {
      // Hide empty sections when searching
      el.classList.add('section-hidden');
    } else {
      el.classList.remove('section-hidden');
      if (groups.length === 0) {
        grid.innerHTML = '<p class="empty-state" style="padding:1rem">No PIs in this category.</p>';
      } else {
        groups.forEach(g => grid.appendChild(createCard(g)));
        totalVisible += groups.length;
      }
    }

    // Auto-expand sections with results when searching, collapse when not
    if (isSearching && groups.length > 0) {
      el.classList.remove('collapsed');
      sections[sf].header.setAttribute('aria-expanded', 'true');
    } else if (!isSearching) {
      el.classList.add('collapsed');
      sections[sf].header.setAttribute('aria-expanded', 'false');
    }
  });

  // Hide "No PIs found" message when searching (sections handle their own visibility)
  groupsEmpty.classList.add('hidden');
}

function createCard(group) {
  const card = document.createElement('article');
  card.className = 'group-card';
  const sf = group.subfield || 'computational';
  card.dataset.subfield = sf;

  const keywordHTML = (group.keywords || [])
    .map(k => `<span class="keyword-pill">${escapeHTML(k)}</span>`)
    .join('');

  const instituteHTML = group.institute
    ? `<div class="card-institute">${escapeHTML(group.institute)}</div>`
    : '';

  card.innerHTML = `
    <div class="card-body">
      <h3 class="card-name">${escapeHTML(group.name)}</h3>
      ${instituteHTML}
      <div class="card-keywords">${keywordHTML}</div>
      <p class="card-summary">${escapeHTML(group.summary || '')}</p>
    </div>
  `;

  // Click card to open PI detail (skip if clicking a link or button)
  card.addEventListener('click', (e) => {
    if (e.target.closest('a') || e.target.closest('button')) return;
    openPiDetail(group);
  });

  return card;
}

async function openPiDetail(group) {
  currentDetailGroup = group;

  // Populate modal fields
  piDetailTitle.textContent = group.name || 'PI Details';
  piDetailPhoto.src = group.photoURL || 'assets/placeholder-lab.svg';
  piDetailPhoto.alt = group.name || '';
  piDetailInstitute.textContent = group.institute || '';
  piDetailInstitute.classList.toggle('hidden', !group.institute);

  const sf = group.subfield || 'computational';
  piDetailSubfield.textContent = sf;
  piDetailSubfield.dataset.subfield = sf;

  piDetailKeywords.innerHTML = (group.keywords || [])
    .map(k => `<span class="keyword-pill">${escapeHTML(k)}</span>`)
    .join('');

  piDetailSummary.textContent = group.summary || '';

  piDetailLinks.innerHTML = (group.links || [])
    .map(l => `<a href="${escapeHTML(l.url)}" class="card-link" target="_blank" rel="noopener noreferrer">${escapeHTML(l.label)}</a>`)
    .join('');

  // Reset sections
  piDetailEditSection.classList.add('hidden');
  piDetailClaimSection.classList.add('hidden');
  piDetailClaimPending.classList.add('hidden');
  piDetailClaimed.classList.add('hidden');
  btnClaimPi.disabled = false;
  btnClaimPi.textContent = 'Claim this page';

  const user = getCurrentUser();
  const isAdmin = getIsAdmin();
  const isCreator = user && group.creatorUid && group.creatorUid === user.uid;
  const isClaimer = user && group.claimedBy && group.claimedBy === user.uid;

  // Show edit button for admins, creators, or claimedBy users
  if (user && (isAdmin || isCreator || isClaimer)) {
    piDetailEditSection.classList.remove('hidden');
  }

  // Show "managed by PI" badge if already claimed
  if (group.claimedBy) {
    piDetailClaimed.classList.remove('hidden');
  }

  // Always show claim button initially (except for current claimer)
  if (user && isClaimer) {
    // Already the claimer — no button needed
  } else {
    piDetailClaimSection.classList.remove('hidden');
  }

  modalPiDetail.classList.remove('hidden');

  // After modal is open, check for existing pending claim (logged-in users only)
  if (user && !isClaimer) {
    try {
      const existingClaim = await fetchMyClaimForTarget(user.uid, group.id);
      if (existingClaim) {
        piDetailClaimSection.classList.add('hidden');
        piDetailClaimPending.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Error checking claim:', err);
    }
  }
}

// Claim modal refs
const modalClaim = document.getElementById('modal-claim');
const claimStepAuth = document.getElementById('claim-step-auth');
const claimStepJustify = document.getElementById('claim-step-justify');
const claimAuthEmail = document.getElementById('claim-auth-email');
const claimAuthPassword = document.getElementById('claim-auth-password');
const claimAuthMessage = document.getElementById('claim-auth-message');
const btnClaimCreate = document.getElementById('btn-claim-create');
const btnClaimLogin = document.getElementById('btn-claim-login');
const claimJustification = document.getElementById('claim-justification');
const claimSubmitMessage = document.getElementById('claim-submit-message');
const btnClaimSubmit = document.getElementById('btn-claim-submit');

function openClaimModal() {
  if (!currentClaimTarget) return;
  const user = getCurrentUser();

  // Reset form state
  claimAuthEmail.value = '';
  claimAuthPassword.value = '';
  claimAuthMessage.classList.add('hidden');
  claimJustification.value = '';
  claimSubmitMessage.classList.add('hidden');
  btnClaimCreate.disabled = false;
  btnClaimLogin.disabled = false;
  btnClaimSubmit.disabled = false;

  if (user) {
    // Already logged in: skip auth step
    claimStepAuth.classList.add('hidden');
  } else {
    claimStepAuth.classList.remove('hidden');
  }

  modalClaim.classList.remove('hidden');
}

function showClaimMsg(el, text, type) {
  el.textContent = text;
  el.className = `form-message ${type}`;
  el.classList.remove('hidden');
}

async function handleClaimAuth(isCreate) {
  const email = claimAuthEmail.value.trim();
  const password = claimAuthPassword.value.trim();
  claimAuthMessage.classList.add('hidden');

  if (!email || !password) {
    showClaimMsg(claimAuthMessage, 'Email and password are required.', 'error');
    return;
  }
  if (isCreate && password.length < 6) {
    showClaimMsg(claimAuthMessage, 'Password must be at least 6 characters.', 'error');
    return;
  }

  btnClaimCreate.disabled = true;
  btnClaimLogin.disabled = true;

  try {
    if (isCreate) {
      await createAccount(email, password);
    } else {
      await login(email, password);
    }
    // Auth succeeded — hide auth step
    claimStepAuth.classList.add('hidden');
  } catch (err) {
    console.error('Claim auth error:', err);
    showClaimMsg(claimAuthMessage, err.message || 'Authentication failed.', 'error');
  } finally {
    btnClaimCreate.disabled = false;
    btnClaimLogin.disabled = false;
  }
}

async function handleClaimSubmit() {
  const user = getCurrentUser();
  if (!user) {
    showClaimMsg(claimSubmitMessage, 'Please log in or create an account first.', 'error');
    return;
  }

  if (!currentClaimTarget) return;

  const justification = claimJustification.value.trim();
  if (!justification) {
    showClaimMsg(claimSubmitMessage, 'Please explain why you can claim this page.', 'error');
    return;
  }

  btnClaimSubmit.disabled = true;
  btnClaimSubmit.textContent = 'Submitting...';

  try {
    await createClaim({
      targetId: currentClaimTarget.id,
      targetName: currentClaimTarget.name,
      type: currentClaimTarget.type,
      claimantUid: user.uid,
      claimantEmail: user.email,
      justification
    });
    // Close claim modal, update detail to show pending
    modalClaim.classList.add('hidden');

    if (currentClaimTarget.type === 'institute') {
      instDetailClaimSection.classList.add('hidden');
      instDetailClaimPending.classList.remove('hidden');
    } else {
      piDetailClaimSection.classList.add('hidden');
      piDetailClaimPending.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Claim submit error:', err);
    showClaimMsg(claimSubmitMessage, 'Error submitting claim. Please try again.', 'error');
  } finally {
    btnClaimSubmit.disabled = false;
    btnClaimSubmit.textContent = 'Submit Claim';
  }
}

export function initPiDetail() {
  btnClaimPi.addEventListener('click', () => {
    if (!currentDetailGroup) return;
    currentClaimTarget = { id: currentDetailGroup.id, name: currentDetailGroup.name, type: 'pi' };
    openClaimModal();
  });
  btnPiDetailEdit.addEventListener('click', () => {
    if (!currentDetailGroup) return;
    modalPiDetail.classList.add('hidden');
    document.dispatchEvent(new CustomEvent('creator-edit-group', { detail: currentDetailGroup }));
  });

  // Claim modal buttons
  btnClaimCreate.addEventListener('click', () => handleClaimAuth(true));
  btnClaimLogin.addEventListener('click', () => handleClaimAuth(false));
  btnClaimSubmit.addEventListener('click', handleClaimSubmit);
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function initSearch() {
  searchInput.addEventListener('input', filterGroups);
}

// Institutes public section
const institutesSection = document.querySelector('.subfield-section[data-subfield="institutes"]');
const institutesPublicList = document.getElementById('institutes-public-list');
const institutesPublicCount = document.getElementById('institutes-public-count');

export function setInstituteFilter(name) {
  if (activeInstitute === name) {
    // Toggle off
    activeInstitute = null;
    instituteFilterBanner.classList.add('hidden');
  } else {
    activeInstitute = name;
    instituteFilterName.textContent = name;
    instituteFilterBanner.classList.remove('hidden');
    // Expand subfield sections so filtered groups are visible
    SUBFIELDS.forEach(sf => {
      sections[sf].el.classList.remove('collapsed');
      sections[sf].header.setAttribute('aria-expanded', 'true');
    });
  }
  // Update active state on institute cards
  institutesPublicList.querySelectorAll('.institute-card').forEach(card => {
    card.classList.toggle('active', card.dataset.institute === activeInstitute);
  });
  renderGroups();
  // Scroll to the groups area
  if (activeInstitute) {
    instituteFilterBanner.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export async function loadPublicInstitutes() {
  try {
    allInstitutes = await fetchApprovedInstitutes();
  } catch (err) {
    console.error('Error loading public institutes:', err);
    allInstitutes = [];
  }
  renderInstitutes();
}

function renderInstitutes() {
  institutesPublicList.innerHTML = '';

  const isSearching = !!searchText;

  const filtered = allInstitutes.filter(inst => {
    if (!searchText) return true;
    const haystack = [
      inst.name,
      inst.summary || '',
      ...(inst.keywords || [])
    ].join(' ').toLowerCase();
    return haystack.includes(searchText);
  });

  institutesPublicCount.textContent = filtered.length;

  if (isSearching && filtered.length === 0) {
    // Hide institutes section when searching with no matches
    institutesSection.classList.add('section-hidden');
    return;
  }

  institutesSection.classList.remove('section-hidden');

  if (filtered.length === 0) {
    institutesPublicList.innerHTML = '<p class="empty-state" style="padding:1rem">No institutes yet.</p>';
    return;
  }

  filtered.forEach(inst => {
    institutesPublicList.appendChild(createInstituteCard(inst));
  });

  // Auto-expand institutes section when searching with results, collapse when not
  const instHeader = institutesSection.querySelector('.subfield-header');
  if (isSearching && filtered.length > 0) {
    institutesSection.classList.remove('collapsed');
    instHeader.setAttribute('aria-expanded', 'true');
  } else if (!isSearching) {
    institutesSection.classList.add('collapsed');
    instHeader.setAttribute('aria-expanded', 'false');
  }
}

function createInstituteCard(inst) {
  const card = document.createElement('article');
  card.className = 'group-card institute-card-rich';
  card.dataset.institute = inst.name;

  const keywordHTML = (inst.keywords || [])
    .map(k => `<span class="keyword-pill keyword-pill-institute">${escapeHTML(k)}</span>`)
    .join('');

  const summaryText = inst.summary || '';
  const truncated = summaryText.length > 120 ? summaryText.slice(0, 120) + '...' : summaryText;

  const websiteHTML = inst.website
    ? `<div class="card-links"><a href="${escapeHTML(inst.website)}" class="card-link" target="_blank" rel="noopener noreferrer">Website</a></div>`
    : '';

  card.innerHTML = `
    <div class="card-body">
      <h3 class="card-name">${escapeHTML(inst.name)}</h3>
      ${keywordHTML ? `<div class="card-keywords">${keywordHTML}</div>` : ''}
      ${truncated ? `<p class="card-summary">${escapeHTML(truncated)}</p>` : ''}
      ${websiteHTML}
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('a') || e.target.closest('button')) return;
    openInstituteDetail(inst);
  });

  return card;
}

async function openInstituteDetail(inst) {
  currentDetailInstitute = inst;

  instDetailTitle.textContent = inst.name || 'Institute Details';
  instDetailLogo.src = inst.logoURL || 'assets/placeholder-lab.svg';
  instDetailLogo.alt = inst.name || '';

  if (inst.website) {
    instDetailWebsite.innerHTML = `<a href="${escapeHTML(inst.website)}" class="card-link" target="_blank" rel="noopener noreferrer">${escapeHTML(inst.website)}</a>`;
    instDetailWebsite.classList.remove('hidden');
  } else {
    instDetailWebsite.innerHTML = '';
    instDetailWebsite.classList.add('hidden');
  }

  instDetailKeywords.innerHTML = (inst.keywords || [])
    .map(k => `<span class="keyword-pill keyword-pill-institute">${escapeHTML(k)}</span>`)
    .join('');

  instDetailSummary.textContent = inst.summary || '';

  instDetailLinks.innerHTML = (inst.links || [])
    .map(l => `<a href="${escapeHTML(l.url)}" class="card-link" target="_blank" rel="noopener noreferrer">${escapeHTML(l.label)}</a>`)
    .join('');

  // Reset sections
  instDetailEditSection.classList.add('hidden');
  instDetailClaimSection.classList.add('hidden');
  instDetailClaimPending.classList.add('hidden');
  instDetailClaimed.classList.add('hidden');

  const user = getCurrentUser();
  const isAdmin = getIsAdmin();
  const isClaimer = user && inst.claimedBy && inst.claimedBy === user.uid;

  // Show edit button for admins or claimedBy users
  if (user && (isAdmin || isClaimer)) {
    instDetailEditSection.classList.remove('hidden');
  }

  // Show "managed by member" badge if already claimed
  if (inst.claimedBy) {
    instDetailClaimed.classList.remove('hidden');
  }

  // Show claim button (except for current claimer)
  if (user && isClaimer) {
    // Already the claimer — no button needed
  } else {
    instDetailClaimSection.classList.remove('hidden');
  }

  modalInstDetail.classList.remove('hidden');

  // Check for existing pending claim
  if (user && !isClaimer) {
    try {
      const existingClaim = await fetchMyClaimForTarget(user.uid, inst.id);
      if (existingClaim) {
        instDetailClaimSection.classList.add('hidden');
        instDetailClaimPending.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Error checking institute claim:', err);
    }
  }
}

export function initInstituteDetail() {
  btnClaimInst.addEventListener('click', () => {
    if (!currentDetailInstitute) return;
    currentClaimTarget = { id: currentDetailInstitute.id, name: currentDetailInstitute.name, type: 'institute' };
    openClaimModal();
  });

  btnInstDetailEdit.addEventListener('click', () => {
    if (!currentDetailInstitute) return;
    modalInstDetail.classList.add('hidden');
    document.dispatchEvent(new CustomEvent('creator-edit-institute', { detail: currentDetailInstitute }));
  });

  btnInstViewPis.addEventListener('click', () => {
    if (!currentDetailInstitute) return;
    modalInstDetail.classList.add('hidden');
    setInstituteFilter(currentDetailInstitute.name);
  });
}

export function initSections() {
  SUBFIELDS.forEach(sf => {
    sections[sf].header.addEventListener('click', () => {
      const section = sections[sf].el;
      const isCollapsed = section.classList.toggle('collapsed');
      sections[sf].header.setAttribute('aria-expanded', !isCollapsed);
    });
  });

  // Institutes section toggle
  const instHeader = institutesSection.querySelector('.subfield-header');
  instHeader.addEventListener('click', () => {
    const isCollapsed = institutesSection.classList.toggle('collapsed');
    instHeader.setAttribute('aria-expanded', !isCollapsed);
  });

  // Institute filter clear
  instituteFilterClear.addEventListener('click', () => {
    setInstituteFilter(activeInstitute); // toggle off
  });
}
