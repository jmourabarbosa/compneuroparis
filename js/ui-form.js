import { createSubmission } from './db.js';

const form = document.getElementById('submission-form');
const formWrapper = document.getElementById('submission-form-wrapper');
const btnShowForm = document.getElementById('btn-show-form');
const formMessage = document.getElementById('form-message');
const linksContainer = document.getElementById('links-container');
const btnAddLink = document.getElementById('btn-add-link');

export function initForm() {
  btnShowForm.addEventListener('click', () => {
    formWrapper.classList.remove('hidden');
    btnShowForm.classList.add('hidden');
  });

  btnAddLink.addEventListener('click', () => {
    addLinkRow(linksContainer);
  });

  form.addEventListener('submit', handleSubmit);
}

function addLinkRow(container) {
  const row = document.createElement('div');
  row.className = 'link-row';
  row.innerHTML = `
    <input type="text" name="link-label" placeholder="Label (e.g. Website)">
    <input type="url" name="link-url" placeholder="https://...">
  `;
  container.appendChild(row);
}

async function handleSubmit(e) {
  e.preventDefault();
  hideMessage(formMessage);

  const name = form.elements.name.value.trim();
  const keywordsRaw = form.elements.keywords.value.trim();
  const summary = form.elements.summary.value.trim();
  const photoURL = form.elements.photoURL.value.trim();
  const submitterEmail = form.elements.submitterEmail.value.trim();
  const submitterNote = form.elements.submitterNote.value.trim();

  if (!name || !keywordsRaw || !summary) {
    showMessage(formMessage, 'Please fill in all required fields.', 'error');
    return;
  }

  const keywords = keywordsRaw.split(',').map(k => k.trim()).filter(Boolean);

  // Gather links
  const linkRows = linksContainer.querySelectorAll('.link-row');
  const links = [];
  linkRows.forEach(row => {
    const label = row.querySelector('[name="link-label"]').value.trim();
    const url = row.querySelector('[name="link-url"]').value.trim();
    if (label && url) links.push({ label, url });
  });

  const submitBtn = document.getElementById('btn-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    await createSubmission({
      name,
      keywords,
      summary,
      links,
      photoURL,
      submitterEmail,
      submitterNote
    });

    showMessage(formMessage, 'Thank you! Your submission is pending review.', 'success');
    form.reset();
    // Reset links to single row
    linksContainer.innerHTML = '';
    addLinkRow(linksContainer);
  } catch (err) {
    console.error('Submission error:', err);
    showMessage(formMessage, 'Something went wrong. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit for Review';
  }
}

function showMessage(el, text, type) {
  el.textContent = text;
  el.className = `form-message ${type}`;
  el.classList.remove('hidden');
}

function hideMessage(el) {
  el.classList.add('hidden');
  el.textContent = '';
}
