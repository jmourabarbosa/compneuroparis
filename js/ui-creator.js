import { fetchGroupsClaimedBy, fetchGroupsByCreator, fetchInstitutesClaimedBy, fetchJobsByPoster, deleteJob } from './db.js';
import { getCurrentUser } from './auth.js';
import { handleDeepLink } from './ui-groups.js';

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ========== LOAD DATA ==========

async function loadCreatorPages(uid) {
  const list = document.getElementById('creator-pages-list');
  const empty = document.getElementById('creator-pages-empty');
  const loading = document.getElementById('creator-pages-loading');

  list.innerHTML = '';
  empty.classList.add('hidden');
  loading.classList.remove('hidden');

  try {
    const [claimed, created] = await Promise.all([
      fetchGroupsClaimedBy(uid),
      fetchGroupsByCreator(uid)
    ]);

    // Merge and deduplicate (a page can be both claimed and created)
    const seen = new Set();
    const pages = [];
    for (const g of [...claimed, ...created]) {
      if (!seen.has(g.id)) {
        seen.add(g.id);
        pages.push(g);
      }
    }

    loading.classList.add('hidden');

    if (pages.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    pages.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    for (const g of pages) {
      const item = document.createElement('div');
      item.className = 'admin-item';
      const badges = [];
      if (g.claimedBy === uid) badges.push('<span class="badge badge-claimed">Claimed</span>');
      if (g.creatorUid === uid) badges.push('<span class="badge badge-created">Created</span>');
      item.innerHTML = `
        <div class="admin-item-info">
          <strong>${escapeHTML(g.name)}</strong>
          ${badges.join(' ')}
        </div>
        <div class="admin-item-actions">
          <button class="btn btn-outline btn-sm btn-creator-view-pi">View</button>
          <button class="btn btn-primary btn-sm btn-creator-edit-pi">Edit</button>
        </div>`;
      item.querySelector('.btn-creator-view-pi').addEventListener('click', () => {
        document.getElementById('modal-creator').classList.add('hidden');
        window.location.hash = `pi-${g.id}`;
        handleDeepLink();
      });
      item.querySelector('.btn-creator-edit-pi').addEventListener('click', () => {
        document.getElementById('modal-creator').classList.add('hidden');
        document.dispatchEvent(new CustomEvent('creator-edit-group', { detail: g }));
      });
      list.appendChild(item);
    }
  } catch (err) {
    console.error('Error loading creator pages:', err);
    loading.classList.add('hidden');
    empty.textContent = 'Error loading pages.';
    empty.classList.remove('hidden');
  }
}

async function loadCreatorInstitutes(uid) {
  const list = document.getElementById('creator-institutes-list');
  const empty = document.getElementById('creator-institutes-empty');
  const loading = document.getElementById('creator-institutes-loading');

  list.innerHTML = '';
  empty.classList.add('hidden');
  loading.classList.remove('hidden');

  try {
    const institutes = await fetchInstitutesClaimedBy(uid);

    loading.classList.add('hidden');

    if (institutes.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    institutes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    for (const inst of institutes) {
      const item = document.createElement('div');
      item.className = 'admin-item';
      item.innerHTML = `
        <div class="admin-item-info">
          <strong>${escapeHTML(inst.name)}</strong>
        </div>
        <div class="admin-item-actions">
          <button class="btn btn-outline btn-sm btn-creator-view-inst">View</button>
          <button class="btn btn-primary btn-sm btn-creator-edit-inst">Edit</button>
        </div>`;
      item.querySelector('.btn-creator-view-inst').addEventListener('click', () => {
        document.getElementById('modal-creator').classList.add('hidden');
        window.location.hash = `inst-${inst.id}`;
        handleDeepLink();
      });
      item.querySelector('.btn-creator-edit-inst').addEventListener('click', () => {
        document.getElementById('modal-creator').classList.add('hidden');
        document.dispatchEvent(new CustomEvent('creator-edit-institute', { detail: inst }));
      });
      list.appendChild(item);
    }
  } catch (err) {
    console.error('Error loading creator institutes:', err);
    loading.classList.add('hidden');
    empty.textContent = 'Error loading institutions.';
    empty.classList.remove('hidden');
  }
}

async function loadCreatorJobs(uid) {
  const list = document.getElementById('creator-jobs-list');
  const empty = document.getElementById('creator-jobs-empty');
  const loading = document.getElementById('creator-jobs-loading');

  list.innerHTML = '';
  empty.classList.add('hidden');
  loading.classList.remove('hidden');

  try {
    const jobs = await fetchJobsByPoster(uid);

    loading.classList.add('hidden');

    if (jobs.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    // Sort by creation date descending
    jobs.sort((a, b) => {
      const ta = a.createdAt?.toDate?.() || new Date(0);
      const tb = b.createdAt?.toDate?.() || new Date(0);
      return tb - ta;
    });

    for (const job of jobs) {
      const item = document.createElement('div');
      item.className = 'admin-item';
      const dateStr = job.createdAt?.toDate
        ? job.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';
      item.innerHTML = `
        <div class="admin-item-info">
          <strong>${escapeHTML(job.title || 'Untitled')}</strong>
          <span class="job-position-badge">${escapeHTML(job.positionType || '')}</span>
          <small>${escapeHTML(job.piName || '')}</small>
          ${dateStr ? `<small class="text-muted">${dateStr}</small>` : ''}
        </div>
        <div class="admin-item-actions">
          <button class="btn btn-outline btn-sm btn-creator-view-job">View</button>
          <button class="btn btn-danger btn-sm btn-creator-delete-job">Delete</button>
        </div>`;
      item.querySelector('.btn-creator-view-job').addEventListener('click', () => {
        document.getElementById('modal-creator').classList.add('hidden');
        window.location.hash = `job-${job.id}`;
        handleDeepLink();
      });
      item.querySelector('.btn-creator-delete-job').addEventListener('click', async (e) => {
        if (!confirm(`Delete job "${job.title}"?`)) return;
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = 'Deleting...';
        try {
          await deleteJob(job.id);
          item.remove();
          // Check if list is now empty
          if (list.children.length === 0) {
            empty.classList.remove('hidden');
          }
        } catch (err) {
          console.error('Error deleting job:', err);
          btn.disabled = false;
          btn.textContent = 'Delete';
          alert('Failed to delete job.');
        }
      });
      list.appendChild(item);
    }
  } catch (err) {
    console.error('Error loading creator jobs:', err);
    loading.classList.add('hidden');
    empty.textContent = 'Error loading job ads.';
    empty.classList.remove('hidden');
  }
}

// ========== INIT ==========

export function initCreatorPanel() {
  const btn = document.getElementById('btn-creator-panel');
  const modal = document.getElementById('modal-creator');
  if (!btn || !modal) return;

  // Tab switching scoped to #modal-creator
  const tabs = modal.querySelectorAll('.tab');
  const panels = modal.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      panels.forEach(p => p.classList.remove('active'));
      document.getElementById(target).classList.add('active');
    });
  });

  // Open panel button
  btn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    const user = getCurrentUser();
    if (user) {
      loadCreatorPages(user.uid);
      loadCreatorInstitutes(user.uid);
      loadCreatorJobs(user.uid);
    }
  });
}

