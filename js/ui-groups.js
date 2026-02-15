import { fetchGroups, fetchApprovedInstitutes } from './db.js';
import { getCurrentUser, getIsAdmin } from './auth.js';

let allGroups = [];
let activeKeyword = null;
let searchText = '';

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

  const photoSrc = group.photoURL || 'assets/placeholder-lab.svg';

  const keywordHTML = (group.keywords || [])
    .map(k => `<span class="keyword-pill">${escapeHTML(k)}</span>`)
    .join('');

  const linksHTML = (group.links || [])
    .map(l => `<a href="${escapeHTML(l.url)}" class="card-link" target="_blank" rel="noopener noreferrer">${escapeHTML(l.label)}</a>`)
    .join('');

  const instituteHTML = group.institute
    ? `<div class="card-institute">${escapeHTML(group.institute)}</div>`
    : '';

  card.innerHTML = `
    <img class="card-photo" src="${escapeHTML(photoSrc)}" alt="${escapeHTML(group.name)}" loading="lazy">
    <div class="card-body">
      <h3 class="card-name">${escapeHTML(group.name)}</h3>
      ${instituteHTML}
      <div class="card-keywords">${keywordHTML}</div>
      <p class="card-summary">${escapeHTML(group.summary || '')}</p>
      <div class="card-links">${linksHTML}</div>
    </div>
  `;

  // Show Edit button for creators on their own cards (not for admins — they use admin panel)
  const user = getCurrentUser();
  const isAdmin = getIsAdmin();
  if (user && !isAdmin && group.creatorUid && group.creatorUid === user.uid) {
    const editBtn = document.createElement('button');
    editBtn.className = 'card-edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('creator-edit-group', { detail: group }));
    });
    card.querySelector('.card-body').appendChild(editBtn);
  }

  return card;
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
      const websiteHTML = inst.website
        ? `<a href="${escapeHTML(inst.website)}" class="card-link" target="_blank" rel="noopener noreferrer">Website</a>`
        : '';
      card.innerHTML = `
        <div class="institute-card-name">${escapeHTML(inst.name)}</div>
        <div class="institute-card-links">${websiteHTML}</div>
      `;
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
}
