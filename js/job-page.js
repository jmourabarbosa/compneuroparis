import { fetchGroupById, fetchJobById } from './db.js';
import { buildPublicDetailHash, parsePublicJobPageId } from './public-detail-hash-utils.mjs';
import { renderMarkdownToHtml, stripMarkdownToText } from './markdown-render-utils.mjs';
import { formatCardDate } from './public-card-utils.mjs';

const loadingEl = document.getElementById('job-page-loading');
const errorEl = document.getElementById('job-page-error');
const contentEl = document.getElementById('job-page-content');
const notFoundEl = document.getElementById('job-page-not-found');
const titleEl = document.getElementById('job-page-title');
const positionEl = document.getElementById('job-page-position');
const piEl = document.getElementById('job-page-pi');
const dateEl = document.getElementById('job-page-date');
const keywordsEl = document.getElementById('job-page-keywords');
const piKeywordsEl = document.getElementById('job-page-pi-keywords');
const descriptionEl = document.getElementById('job-page-description');
const linksEl = document.getElementById('job-page-links');
const pageDescriptionMeta = document.getElementById('job-page-meta-description');
const ogTitleMeta = document.getElementById('job-page-og-title');
const ogDescriptionMeta = document.getElementById('job-page-og-description');
const ogUrlMeta = document.getElementById('job-page-og-url');

const JOB_MARKDOWN_BY_LINK = {
  'https://jbarbosa.org/files/Interpretable%20AI%20for%20unveiling%20distributed%20computations%20in%20the%20brain.pdf':
    'assets/job-descriptions/interpretable-ai-distributed-computations.md'
};

function showState({ loading = false, error = false, notFound = false, content = false }) {
  loadingEl.classList.toggle('hidden', !loading);
  errorEl.classList.toggle('hidden', !error);
  notFoundEl.classList.toggle('hidden', !notFound);
  contentEl.classList.toggle('hidden', !content);
}

function buildDirectoryHashLink(type, id) {
  return `index.html${buildPublicDetailHash(type, id)}`;
}

function normalizeExternalUrl(url = '') {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

async function resolveJobBody(job, externalUrl) {
  const markdownPath = JOB_MARKDOWN_BY_LINK[externalUrl];
  if (!markdownPath) {
    return { html: '', text: (job.description || '').trim() };
  }

  const response = await fetch(markdownPath);
  if (!response.ok) {
    throw new Error(`Failed to load job markdown: ${response.status}`);
  }

  const markdown = await response.text();
  return {
    html: renderMarkdownToHtml(markdown),
    text: stripMarkdownToText(markdown)
  };
}

async function renderJobPage() {
  const jobId = parsePublicJobPageId(window.location.search);
  if (!jobId) {
    showState({ notFound: true });
    return;
  }

  showState({ loading: true });

  try {
    const job = await fetchJobById(jobId);
    if (!job) {
      showState({ notFound: true });
      return;
    }

    const group = job.piId ? await fetchGroupById(job.piId) : null;
    const dateStr = formatCardDate(job.createdAt);
    const externalUrl = normalizeExternalUrl(job.link);
    const bodyContent = await resolveJobBody(job, externalUrl);
    const summaryText = bodyContent.text || 'Job offer from Neuroscience in Paris.';

    document.title = `${job.title || 'Job Offer'} | Neuroscience in Paris`;
    pageDescriptionMeta?.setAttribute('content', summaryText.slice(0, 160));
    ogTitleMeta?.setAttribute('content', document.title);
    ogDescriptionMeta?.setAttribute('content', summaryText.slice(0, 200));
    ogUrlMeta?.setAttribute('content', window.location.href);

    titleEl.textContent = job.title || 'Job Offer';
    positionEl.textContent = job.positionType || 'Job Offer';
    dateEl.textContent = dateStr ? `Posted ${dateStr}` : '';

    if (group) {
      piEl.innerHTML = '';
      const label = document.createElement('span');
      label.textContent = 'PI: ';
      const link = document.createElement('a');
      link.href = buildDirectoryHashLink('pi', group.id);
      link.textContent = job.piName || group.name || 'View PI';
      piEl.append(label, link);
    } else if (job.piName) {
      piEl.textContent = `PI: ${job.piName}`;
    } else {
      piEl.textContent = '';
    }

    keywordsEl.innerHTML = '';
    const keywords = job.keywords || [];
    keywordsEl.classList.toggle('hidden', keywords.length === 0);
    keywords.forEach((keyword) => {
      const pill = document.createElement('span');
      pill.className = 'keyword-pill keyword-pill-job';
      pill.textContent = keyword;
      keywordsEl.appendChild(pill);
    });

    piKeywordsEl.innerHTML = '';
    const piKeywords = group?.keywords || [];
    piKeywordsEl.classList.toggle('hidden', piKeywords.length === 0);
    piKeywords.forEach((keyword) => {
      const pill = document.createElement('span');
      pill.className = 'keyword-pill';
      pill.textContent = keyword;
      piKeywordsEl.appendChild(pill);
    });

    if (bodyContent.html) {
      descriptionEl.innerHTML = bodyContent.html;
      descriptionEl.classList.remove('hidden');
    } else if (job.description) {
      descriptionEl.textContent = job.description;
      descriptionEl.classList.remove('hidden');
    } else {
      descriptionEl.textContent = '';
      descriptionEl.classList.add('hidden');
    }

    linksEl.innerHTML = '';
    const links = [];
    if (externalUrl) {
      links.push({ href: externalUrl, label: 'External link to job details', external: true });
    }
    links.forEach(({ href, label, external }) => {
      const link = document.createElement('a');
      link.href = href;
      link.className = 'card-link';
      link.textContent = label;
      if (external) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      linksEl.appendChild(link);
    });

    showState({ content: true });
  } catch (error) {
    console.error('Error loading job page:', error);
    showState({ error: true });
  }
}

void renderJobPage();
