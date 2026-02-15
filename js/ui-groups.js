import { fetchGroups, fetchApprovedInstitutes, createClaim, fetchMyClaimForPi } from './db.js';
import { getCurrentUser, getIsAdmin } from './auth.js';

let allGroups = [];
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

  SUBFIELDS.forEach(sf => {
    const { grid, count, el } = sections[sf];
    grid.innerHTML = '';
    const groups = bySubfield[sf];
    count.textContent = groups.length;

    if (groups.length === 0) {
      el.classList.add('section-hidden');
    } else {
      el.classList.remove('section-hidden');
      groups.forEach(g => grid.appendChild(createCard(g)));
      totalVisible += groups.length;
    }
  });

  if (totalVisible === 0) {
    groupsEmpty.classList.remove('hidden');
  } else {
    groupsEmpty.classList.add('hidden');
  }
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

  // Claim logic
  if (group.claimedBy) {
    piDetailClaimed.classList.remove('hidden');
  } else if (user && !isAdmin && !isCreator) {
    // Check for existing pending claim
    try {
      const existingClaim = await fetchMyClaimForPi(user.uid, group.id);
      if (existingClaim) {
        piDetailClaimPending.classList.remove('hidden');
      } else {
        piDetailClaimSection.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Error checking claim:', err);
      piDetailClaimSection.classList.remove('hidden');
    }
  }

  modalPiDetail.classList.remove('hidden');
}

async function handleClaimClick() {
  if (!currentDetailGroup) return;
  const user = getCurrentUser();
  if (!user) return;

  btnClaimPi.disabled = true;
  btnClaimPi.textContent = 'Submitting...';

  try {
    await createClaim({
      piId: currentDetailGroup.id,
      piName: currentDetailGroup.name,
      claimantUid: user.uid,
      claimantEmail: user.email
    });
    // Swap to pending message
    piDetailClaimSection.classList.add('hidden');
    piDetailClaimPending.classList.remove('hidden');
  } catch (err) {
    console.error('Claim error:', err);
    btnClaimPi.disabled = false;
    btnClaimPi.textContent = 'Claim this page';
    alert('Error submitting claim. Please try again.');
  }
}

export function initPiDetail() {
  btnClaimPi.addEventListener('click', handleClaimClick);
  btnPiDetailEdit.addEventListener('click', () => {
    if (!currentDetailGroup) return;
    modalPiDetail.classList.add('hidden');
    document.dispatchEvent(new CustomEvent('creator-edit-group', { detail: currentDetailGroup }));
  });
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
    const institutes = await fetchApprovedInstitutes();
    institutesPublicCount.textContent = institutes.length;
    institutesPublicList.innerHTML = '';

    if (institutes.length === 0) {
      institutesSection.classList.add('section-hidden');
      return;
    }

    institutesSection.classList.remove('section-hidden');
    institutes.forEach(inst => {
      const card = document.createElement('div');
      card.className = 'institute-card';
      card.dataset.institute = inst.name;
      if (activeInstitute === inst.name) card.classList.add('active');
      const websiteHTML = inst.website
        ? `<a href="${escapeHTML(inst.website)}" class="card-link" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">Website</a>`
        : '';
      card.innerHTML = `
        <div class="institute-card-name">${escapeHTML(inst.name)}</div>
        <div class="institute-card-links">${websiteHTML}</div>
      `;
      card.addEventListener('click', () => setInstituteFilter(inst.name));
      institutesPublicList.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading public institutes:', err);
  }
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
