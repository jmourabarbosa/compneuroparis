import { fetchGroups } from './db.js';
import { getCurrentUser, getIsAdmin } from './auth.js';

let allGroups = [];
let activeKeyword = null;
let searchText = '';

const groupsGrid = document.getElementById('groups-grid');
const groupsLoading = document.getElementById('groups-loading');
const groupsEmpty = document.getElementById('groups-empty');
const searchInput = document.getElementById('search-input');
const keywordFilters = document.getElementById('keyword-filters');

export async function loadGroups() {
  groupsLoading.classList.remove('hidden');
  groupsEmpty.classList.add('hidden');
  groupsGrid.innerHTML = '';

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

  groupsGrid.innerHTML = '';

  if (filtered.length === 0) {
    groupsEmpty.classList.remove('hidden');
    return;
  }

  groupsEmpty.classList.add('hidden');

  filtered.forEach(g => {
    groupsGrid.appendChild(createCard(g));
  });
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

  card.innerHTML = `
    <img class="card-photo" src="${escapeHTML(photoSrc)}" alt="${escapeHTML(group.name)}" loading="lazy">
    <div class="card-body">
      <h3 class="card-name">${escapeHTML(group.name)}</h3>
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
