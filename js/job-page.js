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

const JOB_PAGE_CONFIG_BY_LINK = {
  'https://jbarbosa.org/files/Interpretable%20AI%20for%20unveiling%20distributed%20computations%20in%20the%20brain.pdf': {
    markdownPath: 'assets/job-descriptions/interpretable-ai-distributed-computations.md',
    introMarkdown: `# **Interpretable AI for unveiling distributed computations in the brain**

**Advisors:** **Srdjan OSTOJIC (ENS \\- PSL)**, **Joao BARBOSA (Inserm)**  
**Framework:** This PhD thesis will be conducted within the **PR\\[AI\\]RIE-PSAI research program**.

**Deadline for Applications**: 15/05/2026
**Application address**: Applications should be sent directly to the supervisors: srdjan.ostojic@ens.psl.eu, joao.barbosa@inserm.fr

**Required Documents**
* CV of the candidate
* A one-page cover letter describing the ambitions for the described subject and the relevance of the application in relation to the subject description
* Copy of the latest diplomas
* Results will be communicated in two phases between May 30th and mid-June at the latest.`,
    submitters: [
      {
        name: 'Srdjan Ostojic',
        href: 'https://parisneuro.fr/#pi-qLTmyhzzyA0ZgTcqpZcb'
      }
    ]
  }
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

function ensureIntroBeforeContext(markdown = '', introMarkdown = '') {
  if (!introMarkdown) {
    return markdown;
  }

  const contextHeading = '# **Context and Motivation for the Project**';
  const contextIndex = markdown.indexOf(contextHeading);
  if (contextIndex === -1) {
    return markdown ? `${introMarkdown}\n\n${markdown}` : introMarkdown;
  }

  const contentFromContext = markdown.slice(contextIndex).trimStart();
  return `${introMarkdown}\n\n${contentFromContext}`;
}

async function resolveJobBody(job, externalUrl) {
  const jobPageConfig = JOB_PAGE_CONFIG_BY_LINK[externalUrl];
  const markdownPath = jobPageConfig?.markdownPath;
  if (!markdownPath) {
    return { html: '', text: (job.description || '').trim() };
  }

  const response = await fetch(markdownPath);
  if (!response.ok) {
    throw new Error(`Failed to load job markdown: ${response.status}`);
  }

  const markdown = ensureIntroBeforeContext(await response.text(), jobPageConfig?.introMarkdown);
  return {
    html: renderMarkdownToHtml(markdown),
    text: stripMarkdownToText(markdown)
  };
}

function renderSubmitters({ group, job, externalUrl }) {
  const configSubmitters = JOB_PAGE_CONFIG_BY_LINK[externalUrl]?.submitters || [];
  const submitters = [...configSubmitters];

  if (group) {
    submitters.push({
      name: job.piName || group.name || 'View PI',
      href: buildDirectoryHashLink('pi', group.id)
    });
  } else if (job.piName) {
    submitters.push({
      name: job.piName,
      href: ''
    });
  }

  if (submitters.length === 0) {
    piEl.textContent = '';
    return;
  }

  piEl.innerHTML = '';
  const label = document.createElement('span');
  label.textContent = submitters.length > 1 ? 'PIs: ' : 'PI: ';
  piEl.appendChild(label);

  submitters.forEach((submitter, index) => {
    if (index > 0) {
      piEl.appendChild(document.createTextNode(', '));
    }

    if (submitter.href) {
      const link = document.createElement('a');
      link.href = submitter.href;
      link.textContent = submitter.name;
      piEl.appendChild(link);
      return;
    }

    const text = document.createElement('span');
    text.textContent = submitter.name;
    piEl.appendChild(text);
  });
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

    renderSubmitters({ group, job, externalUrl });

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
