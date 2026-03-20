export const MAX_VISIBLE_KEYWORDS = 5;

export function escapeHTML(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatCardDate(dateValue) {
  return dateValue?.toDate
    ? dateValue.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
}

export function buildPiCardMarkup(group, {
  subfieldLabel,
  instituteRefs = [],
  isHiring = false
}) {
  const keywords = group.keywords || [];
  const pills = keywords.map(keyword =>
    `<button class="keyword-pill" data-keyword="${escapeHTML(keyword)}">${escapeHTML(keyword)}</button>`
  );
  const visiblePills = pills.slice(0, MAX_VISIBLE_KEYWORDS).join('');
  const overflowCount = Math.max(0, pills.length - MAX_VISIBLE_KEYWORDS);
  const overflowHTML = overflowCount > 0
    ? `<span class="keywords-overflow keywords-hidden">${pills.slice(MAX_VISIBLE_KEYWORDS).join('')}</span><button class="keyword-more">+${overflowCount}</button>`
    : '';

  const institutesHTML = instituteRefs.length > 0
    ? `<div class="card-institute">${instituteRefs.map(ref => {
      const key = ref.id || ref.name || '';
      return `<a href="#inst-${escapeHTML(key)}" class="card-institute-link" data-institute-key="${escapeHTML(key)}">${escapeHTML(ref.name)}</a>`;
    }).join(', ')}</div>`
    : '';

  const managedHTML = group.claimedBy
    ? '<span class="card-managed-badge">Managed by PI</span>'
    : '<span class="card-unclaimed-badge">Unclaimed</span>';

  const jobBadgeHTML = isHiring ? '<span class="card-job-badge">Hiring</span>' : '';
  const primarySubfield = group.subfields?.[0] || group.subfield || 'computational';
  const subfieldBadgeHTML = `<span class="card-subfield-badge" data-subfield="${escapeHTML(primarySubfield)}">${escapeHTML(subfieldLabel)}</span>`;

  return {
    html: `
      <div class="card-body">
        <div class="card-name-row">
          <h3 class="card-name">${escapeHTML(group.name)}</h3>
          ${subfieldBadgeHTML}
          ${jobBadgeHTML}
          ${managedHTML}
        </div>
        ${institutesHTML}
        <div class="card-keywords">${visiblePills}${overflowHTML}</div>
      </div>
    `,
    overflowCount
  };
}

export function buildInstituteCardMarkup(institute) {
  const keywordHTML = (institute.keywords || [])
    .map(keyword => `<span class="keyword-pill keyword-pill-institute">${escapeHTML(keyword)}</span>`)
    .join('');

  const summaryText = institute.summary || '';
  const truncatedSummary = summaryText.length > 120 ? `${summaryText.slice(0, 120)}...` : summaryText;
  const websiteHTML = institute.website
    ? `<div class="card-links"><a href="${escapeHTML(institute.website)}" class="card-link" target="_blank" rel="noopener noreferrer">Website</a></div>`
    : '';
  const managedHTML = institute.claimedBy
    ? '<span class="card-managed-badge">Claimed</span>'
    : '<span class="card-unclaimed-badge">Unclaimed</span>';

  return `
    <div class="card-body">
      <div class="card-name-row">
        <h3 class="card-name">${escapeHTML(institute.name)}</h3>
        ${managedHTML}
      </div>
      ${keywordHTML ? `<div class="card-keywords">${keywordHTML}</div>` : ''}
      ${truncatedSummary ? `<p class="card-summary">${escapeHTML(truncatedSummary)}</p>` : ''}
      ${websiteHTML}
    </div>
  `;
}

export function buildJobCardMarkup(job, keywords = []) {
  const dateStr = formatCardDate(job.createdAt);
  const keywordHTML = keywords.length > 0
    ? `<div class="card-keywords">${keywords.map(keyword => `<span class="keyword-pill">${escapeHTML(keyword)}</span>`).join('')}</div>`
    : '';

  return `
    <div class="card-body">
      <div class="card-name-row">
        <h3 class="job-card-title">${escapeHTML(job.title)}</h3>
      </div>
      <div class="job-card-pi">${escapeHTML(job.piName || '')}</div>
      ${keywordHTML}
      ${job.description ? `<p class="job-card-description">${escapeHTML(job.description)}</p>` : ''}
      <div class="job-card-meta">
        <span class="job-position-badge">${escapeHTML(job.positionType)}</span>
        ${dateStr ? `<span class="job-card-date">${dateStr}</span>` : ''}
      </div>
    </div>
  `;
}
