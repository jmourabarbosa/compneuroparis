import { fetchGroups, fetchApprovedInstitutes, fetchJobs, fetchJobsByPi, updateJob, deleteJob, updateGroup, createClaim, fetchMyClaimForTarget, fetchApprovedClaimForTarget, revokeClaim, deleteGroup, deleteInstitute, createReport } from './db.js';
import { getCurrentUser, getIsAdmin, createAccount, login, isEmailVerified, resendVerification } from './auth.js';

let allGroups = [];
let allInstitutes = [];
let allJobs = [];
let activeKeywords = new Set();
let searchText = '';
let activeInstitute = null;

const SUBFIELDS = ['computational', 'systems', 'human', 'molecular', 'developmental', 'clinical'];

const SUBFIELD_LABELS = {
  computational: 'Computational',
  systems: 'Systems',
  human: 'Human',
  molecular: 'Molecular',
  developmental: 'Developmental',
  clinical: 'Clinical'
};

let filterHiring = false;
let filterValidated = false;

// Normalize old string or new array format
function toArray(val) { return Array.isArray(val) ? val : (val ? [val] : []); }

// Section refs
const sections = {};
SUBFIELDS.forEach(sf => {
  const section = document.querySelector(`.subfield-section[data-subfield="${sf}"]`);
  sections[sf] = {
    el: section,
    grid: section.querySelector('.groups-grid'),
    count: section.querySelector('.subfield-count'),
    countSecondary: section.querySelector('.subfield-count-secondary'),
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
const piDetailSubfields = document.getElementById('pi-detail-subfields');
const piDetailKeywords = document.getElementById('pi-detail-keywords');
const piDetailSummary = document.getElementById('pi-detail-summary');
const piDetailLinks = document.getElementById('pi-detail-links');
const piDetailClaimSection = document.getElementById('pi-detail-claim-section');
const piDetailClaimPending = document.getElementById('pi-detail-claim-pending');
const piDetailManagedBy = document.getElementById('pi-detail-managed-by');
const btnClaimPi = document.getElementById('btn-claim-pi');
const piDetailEditSection = document.getElementById('pi-detail-edit-section');
const btnPiDetailEdit = document.getElementById('btn-pi-detail-edit');
const btnPiDetailDelete = document.getElementById('btn-pi-detail-delete');
const btnPiReportToggle = document.getElementById('btn-pi-report-toggle');
const piReportForm = document.getElementById('pi-report-form');
const piReportMessage = document.getElementById('pi-report-message');
const piReportMsg = document.getElementById('pi-report-msg');
const btnPiReportSubmit = document.getElementById('btn-pi-report-submit');

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
const instDetailManagedBy = document.getElementById('inst-detail-managed-by');
const btnClaimInst = document.getElementById('btn-claim-inst');
const btnInstDetailEdit = document.getElementById('btn-inst-detail-edit');
const btnInstDetailDelete = document.getElementById('btn-inst-detail-delete');
const btnInstViewPis = document.getElementById('btn-inst-view-pis');
const btnInstReportToggle = document.getElementById('btn-inst-report-toggle');
const instReportForm = document.getElementById('inst-report-form');
const instReportMessage = document.getElementById('inst-report-message');
const instReportMsg = document.getElementById('inst-report-msg');
const btnInstReportSubmit = document.getElementById('btn-inst-report-submit');

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
  // Initial keyword pills are built by renderGroups() via rebuildKeywordPills().
  // This function now just ensures keyword bar visibility on first load.
  keywordFilters.classList.toggle('hidden', searchText.length === 0 && activeKeywords.size === 0);
}

function toggleKeyword(kw, btn) {
  if (activeKeywords.has(kw)) {
    activeKeywords.delete(kw);
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
  } else {
    activeKeywords.add(kw);
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
  }
  renderGroups();
}

export function filterGroups() {
  searchText = searchInput.value.trim().toLowerCase();
  // Clear keyword selection when search is emptied
  if (!searchText) {
    activeKeywords.clear();
  }
  renderGroups();
  renderInstitutes();
  renderJobs();
}

// Levenshtein edit distance
function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Fuzzy match: splits query into words, each must match at least one word in
// the haystack via substring (short words) or Levenshtein distance ≤ 2 (≥ 4 chars).
function fuzzyMatch(haystack, query) {
  const haystackLower = haystack.toLowerCase();
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return true;

  const haystackWords = haystackLower.split(/\s+/).filter(Boolean);

  return queryWords.every(qw => {
    // Substring match first (fast path)
    if (haystackLower.includes(qw)) return true;
    // For short query words (< 4 chars), only allow substring match
    if (qw.length < 4) return false;
    // Levenshtein fuzzy match against individual haystack words
    return haystackWords.some(hw => {
      if (Math.abs(hw.length - qw.length) > 2) return false;
      return editDistance(qw, hw) <= 2;
    });
  });
}

function renderGroups() {
  const filtered = allGroups.filter(g => {
    // Institute filter
    if (activeInstitute) {
      const institutes = toArray(g.institutes || g.institute);
      if (!institutes.includes(activeInstitute)) return false;
    }
    // Keyword filter (PI must have ALL selected keywords)
    if (activeKeywords.size > 0) {
      const kws = (g.keywords || []).map(k => k.trim().toLowerCase());
      for (const ak of activeKeywords) {
        if (!kws.includes(ak)) return false;
      }
    }
    // Text search (fuzzy)
    if (searchText) {
      const institutes = toArray(g.institutes || g.institute);
      const haystack = [
        g.name,
        g.summary,
        ...(g.keywords || []),
        ...institutes
      ].join(' ');
      if (!fuzzyMatch(haystack, searchText)) return false;
    }
    // Hiring filter
    if (filterHiring) {
      const isHiring = g.hiring || allJobs.some(j => j.piId === g.id);
      if (!isHiring) return false;
    }
    // Validated filter
    if (filterValidated) {
      if (!g.claimedBy) return false;
    }
    return true;
  });

  // Partition by subfield into primary (first in array) and secondary
  const primaryBySubfield = { computational: [], systems: [], human: [], molecular: [], developmental: [], clinical: [] };
  const secondaryBySubfield = { computational: [], systems: [], human: [], molecular: [], developmental: [], clinical: [] };
  filtered.forEach(g => {
    const sfs = toArray(g.subfields || g.subfield);
    const validSfs = sfs.filter(sf => primaryBySubfield[sf]);
    if (validSfs.length === 0) validSfs.push('computational');
    validSfs.forEach((sf, i) => {
      if (i === 0 || sf === sfs[0]) {
        primaryBySubfield[sf].push(g);
      } else {
        secondaryBySubfield[sf].push(g);
      }
    });
  });

  // Sort helper: claimed first, then alphabetical
  const sortGroups = (arr) => arr.sort((a, b) => {
    const aClaimed = a.claimedBy ? 0 : 1;
    const bClaimed = b.claimedBy ? 0 : 1;
    if (aClaimed !== bClaimed) return aClaimed - bClaimed;
    return (a.name || '').localeCompare(b.name || '');
  });

  for (const sf of SUBFIELDS) {
    sortGroups(primaryBySubfield[sf]);
    sortGroups(secondaryBySubfield[sf]);
  }

  let totalVisible = 0;

  const isSearching = searchText || activeKeywords.size > 0 || activeInstitute || filterHiring || filterValidated;

  SUBFIELDS.forEach(sf => {
    const { grid, count, countSecondary, el } = sections[sf];
    grid.innerHTML = '';
    // Remove any previous "also does" sub-section
    const prevAlso = el.querySelector('.also-does-section');
    if (prevAlso) prevAlso.remove();

    const primary = primaryBySubfield[sf];
    const secondary = secondaryBySubfield[sf];
    const total = primary.length + (isSearching ? 0 : secondary.length);

    count.textContent = primary.length;
    countSecondary.textContent = (!isSearching && secondary.length > 0) ? `+${secondary.length}` : '';

    if (isSearching && primary.length === 0) {
      el.classList.add('section-hidden');
    } else {
      el.classList.remove('section-hidden');
      if (primary.length === 0 && secondary.length === 0) {
        grid.innerHTML = '<p class="empty-state" style="padding:1rem">No PIs in this category.</p>';
      } else {
        primary.forEach(g => grid.appendChild(createCard(g)));
        totalVisible += primary.length;
      }

      // Build "Also does X neuroscience" collapsible sub-section (only when not searching)
      if (!isSearching && secondary.length > 0) {
        const alsoSection = document.createElement('div');
        alsoSection.className = 'also-does-section collapsed';

        const alsoToggle = document.createElement('button');
        alsoToggle.className = 'also-does-toggle';
        alsoToggle.innerHTML = `<svg class="also-does-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>Also does ${SUBFIELD_LABELS[sf]} neuroscience <span class="subfield-count-secondary" style="margin-left:0.25rem">+${secondary.length}</span>`;
        alsoToggle.addEventListener('click', () => {
          alsoSection.classList.toggle('collapsed');
        });

        const alsoContent = document.createElement('div');
        alsoContent.className = 'also-does-content';
        const alsoGrid = document.createElement('div');
        alsoGrid.className = 'groups-grid';
        secondary.forEach(g => alsoGrid.appendChild(createCard(g)));
        alsoContent.appendChild(alsoGrid);

        alsoSection.appendChild(alsoToggle);
        alsoSection.appendChild(alsoContent);
        el.querySelector('.subfield-content').appendChild(alsoSection);
        totalVisible += secondary.length;
      }
    }

    // Auto-expand sections with results when searching, collapse otherwise
    if (isSearching && primary.length > 0) {
      el.classList.remove('collapsed');
      sections[sf].header.setAttribute('aria-expanded', 'true');
    } else {
      el.classList.add('collapsed');
      sections[sf].header.setAttribute('aria-expanded', 'false');
    }
  });

  // Hide "No PIs found" message when searching (sections handle their own visibility)
  groupsEmpty.classList.add('hidden');

  // Rebuild keyword pills based on filtered PIs
  rebuildKeywordPills(filtered);
}

function rebuildKeywordPills(filteredGroups) {
  keywordFilters.innerHTML = '';

  // No search text → hide keywords entirely
  if (!searchText) {
    activeKeywords.clear();
    keywordFilters.classList.add('hidden');
    return;
  }

  // Collect all keywords from filtered PIs and count how many PIs have each
  const kwCounts = new Map();
  filteredGroups.forEach(g => {
    (g.keywords || []).forEach(k => {
      const kl = k.trim().toLowerCase();
      kwCounts.set(kl, (kwCounts.get(kl) || 0) + 1);
    });
  });

  // Only show keywords that themselves match the search query
  const matching = [...kwCounts.keys()].filter(kw => fuzzyMatch(kw, searchText))
    .sort((a, b) => kwCounts.get(b) - kwCounts.get(a));

  // Remove active keywords that are no longer in the matching set
  for (const ak of [...activeKeywords]) {
    if (!matching.includes(ak)) activeKeywords.delete(ak);
  }

  if (matching.length === 0) {
    keywordFilters.classList.add('hidden');
    return;
  }

  matching.forEach(kw => {
    const btn = document.createElement('button');
    btn.className = 'keyword-btn';
    if (activeKeywords.has(kw)) {
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.setAttribute('aria-pressed', 'false');
    }
    btn.textContent = `${kw} (${kwCounts.get(kw)})`;
    btn.addEventListener('click', () => toggleKeyword(kw, btn));
    keywordFilters.appendChild(btn);
  });
  keywordFilters.classList.remove('hidden');
}

function createCard(group) {
  const card = document.createElement('article');
  card.className = 'group-card';
  const sfs = toArray(group.subfields || group.subfield);
  const sf = sfs[0] || 'computational';
  card.dataset.subfield = sf;

  const MAX_VISIBLE_KEYWORDS = 5;
  const keywords = group.keywords || [];
  const pills = keywords.map(k => `<button class="keyword-pill" data-keyword="${escapeHTML(k)}">${escapeHTML(k)}</button>`);
  const visiblePills = pills.slice(0, MAX_VISIBLE_KEYWORDS).join('');
  const overflowHTML = pills.length > MAX_VISIBLE_KEYWORDS
    ? `<span class="keywords-overflow keywords-hidden">${pills.slice(MAX_VISIBLE_KEYWORDS).join('')}</span><button class="keyword-more">+${pills.length - MAX_VISIBLE_KEYWORDS}</button>`
    : '';
  const keywordHTML = visiblePills + overflowHTML;

  const institutes = toArray(group.institutes || group.institute);
  const instituteHTML = institutes.length > 0
    ? `<div class="card-institute">${escapeHTML(institutes.join(', '))}</div>`
    : '';

  const managedHTML = group.claimedBy
    ? '<span class="card-managed-badge">Managed by PI</span>'
    : '<span class="card-unclaimed-badge">Unclaimed</span>';

  const isHiring = group.hiring || allJobs.some(j => j.piId === group.id);
  const jobBadgeHTML = isHiring ? '<span class="card-job-badge">Hiring</span>' : '';

  const sfLabel = SUBFIELD_LABELS[sf] || sf;
  const sfBadgeHTML = `<span class="card-subfield-badge" data-subfield="${escapeHTML(sf)}">${escapeHTML(sfLabel)}</span>`;

  card.innerHTML = `
    <div class="card-body">
      <div class="card-name-row">
        <h3 class="card-name">${escapeHTML(group.name)}</h3>
        ${sfBadgeHTML}
        ${jobBadgeHTML}
        ${managedHTML}
      </div>
      ${instituteHTML}
      <div class="card-keywords">${keywordHTML}</div>
    </div>
  `;

  // Click card to open PI detail (skip if clicking a link, keyword pill, or more button)
  card.addEventListener('click', (e) => {
    if (e.target.closest('a') || e.target.closest('.keyword-pill') || e.target.closest('.keyword-more')) return;
    openPiDetail(group);
  });

  // Toggle "+N more" keywords
  const moreBtn = card.querySelector('.keyword-more');
  if (moreBtn) {
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const overflow = card.querySelector('.keywords-overflow');
      overflow.classList.toggle('keywords-hidden');
      moreBtn.textContent = overflow.classList.contains('keywords-hidden')
        ? `+${pills.length - MAX_VISIBLE_KEYWORDS}`
        : 'show less';
    });
  }

  return card;
}

async function openPiDetail(group) {
  currentDetailGroup = group;
  history.replaceState(null, '', '#pi-' + group.id);

  // Populate modal fields
  const isHiringDetail = group.hiring || allJobs.some(j => j.piId === group.id);
  piDetailTitle.innerHTML = escapeHTML(group.name || 'PI Details') + (isHiringDetail ? ' <span class="card-job-badge">Hiring</span>' : '');
  piDetailPhoto.src = group.photoURL || 'assets/placeholder-lab.svg';
  piDetailPhoto.alt = group.name || '';
  const institutes = toArray(group.institutes || group.institute);
  piDetailInstitute.textContent = institutes.join(', ');
  piDetailInstitute.classList.toggle('hidden', institutes.length === 0);

  const sfs = toArray(group.subfields || group.subfield);
  if (sfs.length === 0) sfs.push('computational');
  piDetailSubfields.innerHTML = sfs.map(sf =>
    `<span class="pi-detail-subfield-badge" data-subfield="${escapeHTML(sf)}">${escapeHTML(sf)}</span>`
  ).join('');

  piDetailKeywords.innerHTML = (group.keywords || [])
    .map(k => `<button class="keyword-pill" data-keyword="${escapeHTML(k)}">${escapeHTML(k)}</button>`)
    .join('');

  piDetailSummary.textContent = group.summary || '';

  piDetailLinks.innerHTML = (group.links || [])
    .map(l => `<a href="${escapeHTML(l.url)}" class="card-link" target="_blank" rel="noopener noreferrer">${escapeHTML(l.label)}</a>`)
    .join('');

  // Reset sections
  piDetailEditSection.classList.add('hidden');
  piDetailClaimSection.classList.add('hidden');
  piDetailClaimPending.classList.add('hidden');
  btnClaimPi.disabled = false;
  btnClaimPi.textContent = 'Claim this page';

  // Reset report form
  piReportForm.classList.add('hidden');
  piReportMessage.value = '';
  piReportMsg.classList.add('hidden');
  btnPiReportSubmit.disabled = false;

  const user = getCurrentUser();
  const isAdmin = getIsAdmin();
  const isCreator = user && group.creatorUid && group.creatorUid === user.uid;
  const isClaimer = user && group.claimedBy && group.claimedBy === user.uid;

  // Managed-by display
  if (group.claimedBy) {
    let emailStr = '';
    let revokeBtn = '';
    if (isAdmin) {
      let email = group.claimedByEmail;
      if (!email) {
        try {
          const claim = await fetchApprovedClaimForTarget(group.id);
          if (claim) email = claim.claimantEmail;
        } catch (e) { /* ignore */ }
      }
      if (email) emailStr = ` <span class="managed-by-email">(${escapeHTML(email)})</span>`;
      revokeBtn = ' <button class="btn-revoke-claim" data-target-id="' + escapeHTML(group.id) + '" data-type="pi">Remove claim</button>';
    }
    piDetailManagedBy.innerHTML = `<div class="managed-by-badge">Managed by the PI${emailStr}${revokeBtn}</div>`;
  } else {
    piDetailManagedBy.innerHTML = '<div class="unclaimed-warning">Not yet claimed — information was semi-automatically populated and may contain errors</div>';
  }

  // Job ads section
  const piDetailJobs = document.getElementById('pi-detail-jobs');
  piDetailJobs.classList.add('hidden');
  piDetailJobs.innerHTML = '';
  try {
    const piJobs = await fetchJobsByPi(group.id);
    if (piJobs.length > 0) {
      // Add clickable badge in managed-by area
      const jobLabel = piJobs.length === 1 ? '1 job ad' : `${piJobs.length} job ads`;
      const jobBadge = document.createElement('span');
      jobBadge.className = 'pi-detail-jobs-badge';
      jobBadge.textContent = ` · ${jobLabel}`;
      jobBadge.title = 'Click to view job ads';
      jobBadge.addEventListener('click', () => {
        piDetailJobs.classList.toggle('hidden');
      });
      piDetailManagedBy.querySelector('.managed-by-badge, .unclaimed-warning')?.appendChild(jobBadge);

      // Build expandable jobs list
      piDetailJobs.innerHTML = `<div class="pi-detail-jobs-list"></div>`;
      const listEl = piDetailJobs.querySelector('.pi-detail-jobs-list');

      piJobs.forEach(job => {
        const item = document.createElement('div');
        item.className = 'pi-job-item';
        item.style.cursor = 'pointer';
        item.innerHTML = `
          <div class="pi-job-item-info">
            <div class="pi-job-item-title">${escapeHTML(job.title)}</div>
            <div class="pi-job-item-meta">
              <span class="job-position-badge">${escapeHTML(job.positionType)}</span>
              ${job.createdAt?.toDate ? ' · ' + job.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
            </div>
          </div>
        `;

        item.addEventListener('click', () => {
          modalPiDetail.classList.add('hidden');
          openJobDetail(job);
        });

        listEl.appendChild(item);
      });

      piDetailJobs.classList.remove('hidden');
    }
  } catch (e) { /* ignore */ }

  // Show edit button for admins, creators, or claimedBy users
  if (user && (isAdmin || isCreator || isClaimer)) {
    piDetailEditSection.classList.remove('hidden');
  }
  // Show delete button only for admins
  btnPiDetailDelete.classList.toggle('hidden', !isAdmin);

  // Hiring toggle (visible to claimer or admin)
  const hiringToggle = document.getElementById('pi-detail-hiring-toggle');
  const hiringCheckbox = document.getElementById('pi-detail-hiring-checkbox');
  if (user && (isAdmin || isClaimer)) {
    hiringCheckbox.checked = !!group.hiring;
    hiringToggle.classList.remove('hidden');
  } else {
    hiringToggle.classList.add('hidden');
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
      // Show verification notice
      showClaimMsg(claimSubmitMessage, 'Account created! A verification email has been sent. Please verify before submitting your claim.', 'info');
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
  if (!isEmailVerified()) {
    showClaimMsg(claimSubmitMessage, 'Please verify your email before claiming. Check your inbox for a confirmation link.', 'error');
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
  // Share button
  document.getElementById('btn-pi-share').addEventListener('click', async () => {
    const url = window.location.origin + window.location.pathname + '#pi-' + currentDetailGroup.id;
    try {
      await navigator.clipboard.writeText(url);
      const btn = document.getElementById('btn-pi-share');
      btn.classList.add('btn-share-copied');
      setTimeout(() => btn.classList.remove('btn-share-copied'), 1500);
    } catch (e) { /* ignore */ }
  });

  // Clear hash when modal closes
  document.querySelector('[data-close-modal="modal-pi-detail"]').addEventListener('click', () => {
    history.replaceState(null, '', window.location.pathname);
  });
  modalPiDetail.addEventListener('click', (e) => {
    if (e.target === modalPiDetail) history.replaceState(null, '', window.location.pathname);
  });

  // Hiring toggle
  document.getElementById('pi-detail-hiring-checkbox').addEventListener('change', async (e) => {
    if (!currentDetailGroup) return;
    const cb = e.target;
    cb.disabled = true;
    try {
      await updateGroup(currentDetailGroup.id, { hiring: cb.checked });
      currentDetailGroup.hiring = cb.checked;
      // Update the local allGroups cache
      const cached = allGroups.find(g => g.id === currentDetailGroup.id);
      if (cached) cached.hiring = cb.checked;
      // Update title badge
      const isHiringNow = cb.checked || allJobs.some(j => j.piId === currentDetailGroup.id);
      piDetailTitle.innerHTML = escapeHTML(currentDetailGroup.name || 'PI Details') + (isHiringNow ? ' <span class="card-job-badge">Hiring</span>' : '');
      // Re-render cards
      renderGroups();
    } catch (err) {
      console.error('Error toggling hiring:', err);
      cb.checked = !cb.checked;
    } finally {
      cb.disabled = false;
    }
  });

  btnClaimPi.addEventListener('click', () => {
    if (!currentDetailGroup) return;
    currentClaimTarget = { id: currentDetailGroup.id, name: currentDetailGroup.name, type: 'pi' };
    modalPiDetail.classList.add('hidden');
    openClaimModal();
  });
  btnPiDetailEdit.addEventListener('click', () => {
    if (!currentDetailGroup) return;
    modalPiDetail.classList.add('hidden');
    document.dispatchEvent(new CustomEvent('creator-edit-group', { detail: currentDetailGroup }));
  });
  btnPiDetailDelete.addEventListener('click', async () => {
    if (!currentDetailGroup) return;
    if (!confirm(`Delete "${currentDetailGroup.name}"? This cannot be undone.`)) return;
    try {
      await deleteGroup(currentDetailGroup.id);
      modalPiDetail.classList.add('hidden');
      await loadGroups();
    } catch (err) {
      console.error('Delete PI error:', err);
      alert('Error deleting PI.');
    }
  });

  // Report button
  btnPiReportToggle.addEventListener('click', () => {
    piReportForm.classList.toggle('hidden');
  });
  btnPiReportSubmit.addEventListener('click', async () => {
    const msg = piReportMessage.value.trim();
    if (!msg) {
      showReportMsg(piReportMsg, 'Please describe the issue.', 'error');
      return;
    }
    btnPiReportSubmit.disabled = true;
    try {
      const user = getCurrentUser();
      await createReport({
        targetId: currentDetailGroup.id,
        targetName: currentDetailGroup.name,
        type: 'pi',
        reporterEmail: user?.email || '',
        message: msg
      });
      piReportMessage.value = '';
      showReportMsg(piReportMsg, 'Report submitted. Thank you!', 'success');
    } catch (err) {
      console.error('Report error:', err);
      showReportMsg(piReportMsg, 'Error submitting report.', 'error');
    } finally {
      btnPiReportSubmit.disabled = false;
    }
  });

  // Revoke claim (admin only)
  piDetailManagedBy.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-revoke-claim');
    if (!btn) return;
    if (!confirm('Remove this claim? The profile will become unclaimed.')) return;
    btn.disabled = true;
    btn.textContent = 'Removing…';
    try {
      await revokeClaim(btn.dataset.targetId, btn.dataset.type);
      modalPiDetail.classList.add('hidden');
      await loadGroups();
    } catch (err) {
      console.error('Revoke claim error:', err);
      alert('Error removing claim.');
      btn.disabled = false;
      btn.textContent = 'Remove claim';
    }
  });

  // Claim modal buttons
  btnClaimCreate.addEventListener('click', () => handleClaimAuth(true));
  btnClaimLogin.addEventListener('click', () => handleClaimAuth(false));
  btnClaimSubmit.addEventListener('click', handleClaimSubmit);
}

function showReportMsg(el, text, type) {
  el.textContent = text;
  el.className = `form-message ${type}`;
  el.classList.remove('hidden');
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function initSearch() {
  searchInput.addEventListener('input', filterGroups);

  // Delegated click handler for keyword pills everywhere on the page
  document.addEventListener('click', (e) => {
    const pill = e.target.closest('.keyword-pill[data-keyword]');
    if (!pill) return;
    e.stopPropagation();
    const kw = pill.dataset.keyword;

    // Close any open modal
    modalPiDetail.classList.add('hidden');
    modalInstDetail.classList.add('hidden');
    modalJobDetail.classList.add('hidden');

    // Set search input to keyword and auto-select it as active filter
    searchInput.value = kw;
    activeKeywords.clear();
    activeKeywords.add(kw.trim().toLowerCase());
    filterGroups();
  });
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

  // Sort: claimed institutes first, then alphabetical within each group
  filtered.sort((a, b) => {
    const aClaimed = a.claimedBy ? 0 : 1;
    const bClaimed = b.claimedBy ? 0 : 1;
    if (aClaimed !== bClaimed) return aClaimed - bClaimed;
    return (a.name || '').localeCompare(b.name || '');
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

  const managedHTML = inst.claimedBy
    ? '<span class="card-managed-badge">Claimed</span>'
    : '<span class="card-unclaimed-badge">Unclaimed</span>';

  card.innerHTML = `
    <div class="card-body">
      <div class="card-name-row">
        <h3 class="card-name">${escapeHTML(inst.name)}</h3>
        ${managedHTML}
      </div>
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

// Jobs public section
const jobsSection = document.querySelector('.subfield-section[data-subfield="jobs"]');
const jobsPublicList = document.getElementById('jobs-public-list');
const jobsPublicCount = document.getElementById('jobs-public-count');

export async function loadPublicJobs() {
  try {
    allJobs = await fetchJobs();
  } catch (err) {
    console.error('Error loading public jobs:', err);
    allJobs = [];
  }
  renderJobs();
}

function renderJobs() {
  jobsPublicList.innerHTML = '';

  const isSearching = !!searchText;

  const filtered = allJobs.filter(job => {
    if (!searchText) return true;
    const piGroupForSearch = allGroups.find(g => g.id === job.piId);
    const piKwsForSearch = piGroupForSearch ? (piGroupForSearch.keywords || []) : [];
    const haystack = [
      job.piName || '',
      job.title || '',
      job.positionType || '',
      ...(job.keywords || []),
      ...piKwsForSearch
    ].join(' ').toLowerCase();
    return haystack.includes(searchText);
  });

  jobsPublicCount.textContent = filtered.length;

  if (isSearching && filtered.length === 0) {
    jobsSection.classList.add('section-hidden');
    return;
  }

  jobsSection.classList.remove('section-hidden');

  if (filtered.length === 0) {
    jobsPublicList.innerHTML = '<p class="empty-state" style="padding:1rem">No job ads yet.</p>';
    return;
  }

  filtered.forEach(job => {
    jobsPublicList.appendChild(createJobCard(job));
  });

  // Auto-expand jobs section when searching with results
  const jobsHeader = jobsSection.querySelector('.subfield-header');
  if (isSearching && filtered.length > 0) {
    jobsSection.classList.remove('collapsed');
    jobsHeader.setAttribute('aria-expanded', 'true');
  } else if (!isSearching) {
    jobsSection.classList.add('collapsed');
    jobsHeader.setAttribute('aria-expanded', 'false');
  }
}

function createJobCard(job) {
  const card = document.createElement('article');
  card.className = 'job-card';

  const dateStr = job.createdAt?.toDate
    ? job.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  // Gather keywords: PI keywords + job-specific keywords
  const piGroupForCard = allGroups.find(g => g.id === job.piId);
  const piKws = piGroupForCard ? (piGroupForCard.keywords || []) : [];
  const jobKws = job.keywords || [];
  const allKwsForCard = [...piKws, ...jobKws.filter(k => !piKws.map(pk => pk.toLowerCase()).includes(k.toLowerCase()))];
  const kwHTML = allKwsForCard.length > 0
    ? `<div class="card-keywords">${allKwsForCard.map(k => `<span class="keyword-pill">${escapeHTML(k)}</span>`).join('')}</div>`
    : '';

  card.innerHTML = `
    <div class="card-body">
      <div class="card-name-row">
        <h3 class="job-card-title">${escapeHTML(job.title)}</h3>
      </div>
      <div class="job-card-pi">${escapeHTML(job.piName || '')}</div>
      ${kwHTML}
      ${job.description ? `<p class="job-card-description">${escapeHTML(job.description)}</p>` : ''}
      <div class="job-card-meta">
        <span class="job-position-badge">${escapeHTML(job.positionType)}</span>
        ${dateStr ? `<span class="job-card-date">${dateStr}</span>` : ''}
      </div>
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('a') || e.target.closest('button')) return;
    openJobDetail(job);
  });

  return card;
}

// Job Detail modal
let currentDetailJob = null;
const modalJobDetail = document.getElementById('modal-job-detail');

function openJobDetail(job, fromPiDetail = false) {
  currentDetailJob = job;

  document.getElementById('job-detail-title').textContent = job.title || 'Job Details';

  // Position type badge
  document.getElementById('job-detail-position').innerHTML =
    `<span class="job-position-badge">${escapeHTML(job.positionType)}</span>`;

  // PI name — clickable to open PI detail
  const piEl = document.getElementById('job-detail-pi');
  const piGroup = allGroups.find(g => g.id === job.piId);
  if (piGroup) {
    piEl.innerHTML = `PI: <a class="job-detail-pi-link">${escapeHTML(job.piName || '')}</a>`;
    piEl.querySelector('.job-detail-pi-link').addEventListener('click', () => {
      modalJobDetail.classList.add('hidden');
      openPiDetail(piGroup);
    });
  } else {
    piEl.textContent = `PI: ${job.piName || ''}`;
  }

  // PI keywords
  const piKwEl = document.getElementById('job-detail-pi-keywords');
  if (piGroup && (piGroup.keywords || []).length > 0) {
    piKwEl.innerHTML = (piGroup.keywords || [])
      .map(k => `<span class="keyword-pill">${escapeHTML(k)}</span>`)
      .join('');
    piKwEl.classList.remove('hidden');
  } else {
    piKwEl.innerHTML = '';
    piKwEl.classList.add('hidden');
  }

  // Date
  const dateStr = job.createdAt?.toDate
    ? job.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  document.getElementById('job-detail-date').textContent = dateStr ? `Posted ${dateStr}` : '';

  // Job-specific keywords
  const jobKwEl = document.getElementById('job-detail-keywords');
  if ((job.keywords || []).length > 0) {
    jobKwEl.innerHTML = (job.keywords || [])
      .map(k => `<span class="keyword-pill keyword-pill-job">${escapeHTML(k)}</span>`)
      .join('');
    jobKwEl.classList.remove('hidden');
  } else {
    jobKwEl.innerHTML = '';
    jobKwEl.classList.add('hidden');
  }

  // Description
  const descEl = document.getElementById('job-detail-description');
  if (job.description) {
    descEl.textContent = job.description;
    descEl.classList.remove('hidden');
  } else {
    descEl.textContent = '';
    descEl.classList.add('hidden');
  }

  // External link
  let jobLink = job.link || '';
  if (jobLink && !/^https?:\/\//i.test(jobLink)) jobLink = 'https://' + jobLink;
  document.getElementById('job-detail-link').innerHTML = jobLink
    ? `<a href="${escapeHTML(jobLink)}" target="_blank" rel="noopener noreferrer">External link to job details</a>`
    : '';

  // Edit/delete section
  const editSection = document.getElementById('job-detail-edit-section');
  const editForm = document.getElementById('job-detail-edit-form');
  editSection.classList.add('hidden');
  editForm.classList.add('hidden');

  const user = getCurrentUser();
  const canManage = user && (user.uid === job.postedBy || getIsAdmin());
  if (canManage) {
    editSection.classList.remove('hidden');
  }

  modalJobDetail.classList.remove('hidden');
}

export function initJobDetail() {
  const btnEdit = document.getElementById('btn-job-detail-edit');
  const btnDelete = document.getElementById('btn-job-detail-delete');
  const editForm = document.getElementById('job-detail-edit-form');
  const editSection = document.getElementById('job-detail-edit-section');
  const editMsg = document.getElementById('job-edit-message');

  btnEdit.addEventListener('click', () => {
    if (!currentDetailJob) return;
    let jobLink = currentDetailJob.link || '';
    if (jobLink && !/^https?:\/\//i.test(jobLink)) jobLink = 'https://' + jobLink;

    document.getElementById('job-edit-title-input').value = currentDetailJob.title || '';
    document.getElementById('job-edit-type-input').value = currentDetailJob.positionType || 'Other';
    document.getElementById('job-edit-description-input').value = currentDetailJob.description || '';
    document.getElementById('job-edit-link-input').value = jobLink;
    document.getElementById('job-edit-keywords-input').value = (currentDetailJob.keywords || []).join(', ');
    editMsg.classList.add('hidden');
    editSection.classList.add('hidden');
    editForm.classList.remove('hidden');
  });

  document.getElementById('btn-job-edit-cancel').addEventListener('click', () => {
    editForm.classList.add('hidden');
    editSection.classList.remove('hidden');
  });

  document.getElementById('btn-job-edit-save').addEventListener('click', async () => {
    const title = document.getElementById('job-edit-title-input').value.trim();
    const positionType = document.getElementById('job-edit-type-input').value;
    const description = document.getElementById('job-edit-description-input').value.trim();
    const keywordsRaw = document.getElementById('job-edit-keywords-input').value.trim();
    const keywords = keywordsRaw ? keywordsRaw.split(',').map(k => k.trim()).filter(Boolean) : [];
    let link = document.getElementById('job-edit-link-input').value.trim();
    if (!title) {
      editMsg.textContent = 'Title is required.';
      editMsg.className = 'form-message error';
      editMsg.classList.remove('hidden');
      return;
    }
    if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;

    const saveBtn = document.getElementById('btn-job-edit-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      await updateJob(currentDetailJob.id, { title, positionType, description, keywords, link });
      await loadPublicJobs();
      // Re-open with updated data
      const updated = allJobs.find(j => j.id === currentDetailJob.id);
      if (updated) {
        openJobDetail(updated);
      } else {
        modalJobDetail.classList.add('hidden');
      }
    } catch (err) {
      console.error('Update job error:', err);
      editMsg.textContent = 'Error updating job.';
      editMsg.className = 'form-message error';
      editMsg.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });

  btnDelete.addEventListener('click', async () => {
    if (!currentDetailJob) return;
    if (!confirm('Delete this job ad? This cannot be undone.')) return;
    btnDelete.disabled = true;
    btnDelete.textContent = 'Deleting...';
    try {
      await deleteJob(currentDetailJob.id);
      await loadPublicJobs();
      modalJobDetail.classList.add('hidden');
    } catch (err) {
      console.error('Delete job error:', err);
      alert('Error deleting job.');
    } finally {
      btnDelete.disabled = false;
      btnDelete.textContent = 'Delete';
    }
  });
}

async function openInstituteDetail(inst) {
  currentDetailInstitute = inst;
  history.replaceState(null, '', '#inst-' + inst.id);

  instDetailTitle.textContent = inst.name || 'Institution Details';
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

  // Reset report form
  instReportForm.classList.add('hidden');
  instReportMessage.value = '';
  instReportMsg.classList.add('hidden');
  btnInstReportSubmit.disabled = false;

  const user = getCurrentUser();
  const isAdmin = getIsAdmin();
  const isClaimer = user && inst.claimedBy && inst.claimedBy === user.uid;

  // Managed-by display
  if (inst.claimedBy) {
    let emailStr = '';
    let revokeBtn = '';
    if (isAdmin) {
      let email = inst.claimedByEmail;
      if (!email) {
        try {
          const claim = await fetchApprovedClaimForTarget(inst.id);
          if (claim) email = claim.claimantEmail;
        } catch (e) { /* ignore */ }
      }
      if (email) emailStr = ` <span class="managed-by-email">(${escapeHTML(email)})</span>`;
      revokeBtn = ' <button class="btn-revoke-claim" data-target-id="' + escapeHTML(inst.id) + '" data-type="institute">Remove claim</button>';
    }
    instDetailManagedBy.innerHTML = `<div class="managed-by-badge">Managed by a member${emailStr}${revokeBtn}</div>`;
  } else {
    instDetailManagedBy.innerHTML = '<div class="unclaimed-warning">Not yet claimed — information was semi-automatically populated and may contain errors</div>';
  }

  // Show edit button for admins or claimedBy users
  if (user && (isAdmin || isClaimer)) {
    instDetailEditSection.classList.remove('hidden');
  }
  // Show delete button only for admins
  btnInstDetailDelete.classList.toggle('hidden', !isAdmin);

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
  // Share button
  document.getElementById('btn-inst-share').addEventListener('click', async () => {
    const url = window.location.origin + window.location.pathname + '#inst-' + currentDetailInstitute.id;
    try {
      await navigator.clipboard.writeText(url);
      const btn = document.getElementById('btn-inst-share');
      btn.classList.add('btn-share-copied');
      setTimeout(() => btn.classList.remove('btn-share-copied'), 1500);
    } catch (e) { /* ignore */ }
  });

  // Clear hash when modal closes
  document.querySelector('[data-close-modal="modal-institute-detail"]').addEventListener('click', () => {
    history.replaceState(null, '', window.location.pathname);
  });
  document.getElementById('modal-institute-detail').addEventListener('click', (e) => {
    if (e.target.id === 'modal-institute-detail') history.replaceState(null, '', window.location.pathname);
  });
  btnClaimInst.addEventListener('click', () => {
    if (!currentDetailInstitute) return;
    currentClaimTarget = { id: currentDetailInstitute.id, name: currentDetailInstitute.name, type: 'institute' };
    modalInstDetail.classList.add('hidden');
    openClaimModal();
  });

  // Report button
  btnInstReportToggle.addEventListener('click', () => {
    instReportForm.classList.toggle('hidden');
  });
  btnInstReportSubmit.addEventListener('click', async () => {
    const msg = instReportMessage.value.trim();
    if (!msg) {
      showReportMsg(instReportMsg, 'Please describe the issue.', 'error');
      return;
    }
    btnInstReportSubmit.disabled = true;
    try {
      const user = getCurrentUser();
      await createReport({
        targetId: currentDetailInstitute.id,
        targetName: currentDetailInstitute.name,
        type: 'institute',
        reporterEmail: user?.email || '',
        message: msg
      });
      instReportMessage.value = '';
      showReportMsg(instReportMsg, 'Report submitted. Thank you!', 'success');
    } catch (err) {
      console.error('Report error:', err);
      showReportMsg(instReportMsg, 'Error submitting report.', 'error');
    } finally {
      btnInstReportSubmit.disabled = false;
    }
  });

  // Revoke claim (admin only)
  instDetailManagedBy.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-revoke-claim');
    if (!btn) return;
    if (!confirm('Remove this claim? The profile will become unclaimed.')) return;
    btn.disabled = true;
    btn.textContent = 'Removing…';
    try {
      await revokeClaim(btn.dataset.targetId, btn.dataset.type);
      modalInstDetail.classList.add('hidden');
      await loadPublicInstitutes();
    } catch (err) {
      console.error('Revoke claim error:', err);
      alert('Error removing claim.');
      btn.disabled = false;
      btn.textContent = 'Remove claim';
    }
  });

  btnInstDetailEdit.addEventListener('click', () => {
    if (!currentDetailInstitute) return;
    modalInstDetail.classList.add('hidden');
    document.dispatchEvent(new CustomEvent('creator-edit-institute', { detail: currentDetailInstitute }));
  });
  btnInstDetailDelete.addEventListener('click', async () => {
    if (!currentDetailInstitute) return;
    if (!confirm(`Delete "${currentDetailInstitute.name}"? This cannot be undone.`)) return;
    try {
      await deleteInstitute(currentDetailInstitute.id);
      modalInstDetail.classList.add('hidden');
      await loadPublicInstitutes();
    } catch (err) {
      console.error('Delete institute error:', err);
      alert('Error deleting institute.');
    }
  });

  btnInstViewPis.addEventListener('click', () => {
    if (!currentDetailInstitute) return;
    modalInstDetail.classList.add('hidden');
    setInstituteFilter(currentDetailInstitute.name);
  });
}

export function handleDeepLink() {
  const hash = window.location.hash;
  if (!hash) return;
  if (hash.startsWith('#pi-')) {
    const id = hash.slice(4);
    const group = allGroups.find(g => g.id === id);
    if (group) openPiDetail(group);
  } else if (hash.startsWith('#inst-')) {
    const id = hash.slice(6);
    const inst = allInstitutes.find(i => i.id === id);
    if (inst) openInstituteDetail(inst);
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

  // Jobs section toggle
  const jobsHeader = jobsSection.querySelector('.subfield-header');
  jobsHeader.addEventListener('click', () => {
    const isCollapsed = jobsSection.classList.toggle('collapsed');
    jobsHeader.setAttribute('aria-expanded', !isCollapsed);
  });

  // Institute filter clear
  instituteFilterClear.addEventListener('click', () => {
    setInstituteFilter(activeInstitute); // toggle off
  });

  // Filter toggles
  const btnFilterHiring = document.getElementById('filter-hiring');
  const btnFilterValidated = document.getElementById('filter-validated');

  btnFilterHiring.addEventListener('click', () => {
    filterHiring = !filterHiring;
    btnFilterHiring.classList.toggle('active', filterHiring);
    renderGroups();
  });

  btnFilterValidated.addEventListener('click', () => {
    filterValidated = !filterValidated;
    btnFilterValidated.classList.toggle('active', filterValidated);
    renderGroups();
  });
}
