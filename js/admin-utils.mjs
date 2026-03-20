import { toArray } from './institute-links.mjs';
import { escapeHTML } from './public-card-utils.mjs';

export function filterManageGroups(groups = [], term = '') {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) return groups;

  return groups.filter(group => {
    const haystack = [
      group.name || '',
      ...(group.keywords || []),
      ...toArray(group.subfields || group.subfield),
      group.claimedByEmail || ''
    ].join(' ').toLowerCase();
    return haystack.includes(normalizedTerm);
  });
}

export function getManageGroupsEmptyMessage(term = '') {
  return term.trim() ? 'No PI pages match your search.' : 'No PIs yet.';
}

export function buildManageGroupItemMarkup(group) {
  const subfields = toArray(group.subfields || group.subfield);
  const subfieldLabel = subfields.length > 0 ? ` [${subfields.join(', ')}]` : '';
  const claimedLabel = group.claimedBy ? ' (claimed)' : '';

  return `
    <div class="admin-item-info">
      <div class="admin-item-name">${escapeHTML(group.name)}${escapeHTML(subfieldLabel)}${claimedLabel}</div>
      <div class="admin-item-meta">${(group.keywords || []).join(', ')}</div>
    </div>
    <div class="admin-item-actions">
      <button class="btn btn-primary btn-sm btn-edit" aria-label="Edit ${escapeHTML(group.name)}">Edit</button>
      <button class="btn btn-danger btn-sm btn-delete" aria-label="Delete ${escapeHTML(group.name)}">Delete</button>
    </div>
  `;
}

export function getClaimSectionSummary(group = {}) {
  if (!group.claimedBy) {
    return 'Currently unclaimed.';
  }
  return `Currently claimed by ${group.claimedByEmail || 'unknown email'}.`;
}

export function buildClaimantOptionData(users = [], group = {}) {
  const options = [
    { value: '', label: 'Unclaimed' },
    ...users
      .slice()
      .sort((a, b) => (a.email || '').localeCompare(b.email || ''))
      .map(user => ({
        value: user.uid,
        label: `${user.email || user.uid}${user.displayName ? ` (${user.displayName})` : ''}${user.emailVerified ? '' : ' (unverified)'}`
      }))
  ];

  const hasCurrent = group.claimedBy && users.some(user => user.uid === group.claimedBy);
  if (group.claimedBy && !hasCurrent) {
    options.push({
      value: group.claimedBy,
      label: group.claimedByEmail
        ? `${group.claimedByEmail} (account not found)`
        : `${group.claimedBy} (account not found)`
    });
  }

  return options;
}

export function buildInstitutePillsMarkup(institutes = []) {
  return institutes.map(inst =>
    `<span class="institute-pill">${escapeHTML(inst.name)} <button type="button" class="institute-pill-remove" data-key="${escapeHTML(inst.id || inst.name)}">&times;</button></span>`
  ).join('');
}

export function filterUsers(users = [], term = '') {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) return users;

  return users.filter(user => {
    const haystack = [
      user.email || '',
      user.displayName || '',
      user.uid || ''
    ].join(' ').toLowerCase();
    return haystack.includes(normalizedTerm);
  });
}

export function getUsersEmptyMessage(term = '') {
  return term.trim() ? 'No users match your search.' : 'No registered users.';
}

export function buildUserAdminItemMarkup(user) {
  const created = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '';
  const verifiedLabel = user.emailVerified ? '' : ' (unverified)';
  const verifyBtn = user.emailVerified ? '' : `<button class="btn btn-success btn-sm btn-verify-user" aria-label="Verify ${escapeHTML(user.email)}">Verify</button>`;

  return `
    <div class="admin-item-info">
      <div class="admin-item-name">${escapeHTML(user.email)}${user.displayName ? ` (${escapeHTML(user.displayName)})` : ''}${verifiedLabel}</div>
      <div class="admin-item-meta">UID: ${escapeHTML(user.uid)}${created ? ` | Joined: ${created}` : ''}${user.disabled ? ' | Disabled' : ''}</div>
    </div>
    <div class="admin-item-actions">
      ${verifyBtn}
      <button class="btn btn-primary btn-sm btn-edit-user" aria-label="Edit ${escapeHTML(user.email)}">Edit</button>
      <button class="btn btn-danger btn-sm btn-delete-user" aria-label="Delete ${escapeHTML(user.email)}">Delete</button>
    </div>
  `;
}
