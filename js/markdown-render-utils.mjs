import { escapeHTML } from './public-card-utils.mjs';

function unescapeMarkdownEscapes(text) {
  return text.replace(/\\([\\`*_{}\[\]()#+\-.!])/g, '$1');
}

function renderInlineMarkdown(text) {
  const escaped = escapeHTML(unescapeMarkdownEscapes(text));
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function stripMarkdownSyntax(text) {
  return unescapeMarkdownEscapes(text)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\*\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\s{2,}\n/g, '\n');
}

function renderParagraph(lines) {
  let html = '';
  lines.forEach((line, index) => {
    const trimmed = line.replace(/\s+$/, '');
    html += renderInlineMarkdown(trimmed);
    if (index < lines.length - 1) {
      html += line.endsWith('  ') ? '<br>' : ' ';
    }
  });
  return `<p>${html}</p>`;
}

export function renderMarkdownToHtml(markdown = '') {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2].trim())}</h${level}>`);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('* ')) {
      const items = [];
      while (index < lines.length && lines[index].trim().startsWith('* ')) {
        items.push(`<li>${renderInlineMarkdown(lines[index].trim().slice(2))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length) {
      const nextLine = lines[index];
      const nextTrimmed = nextLine.trim();
      if (!nextTrimmed || /^(#{1,6})\s+/.test(nextTrimmed) || nextTrimmed.startsWith('* ')) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push(renderParagraph(paragraphLines));
      continue;
    }

    index += 1;
  }

  return blocks.join('');
}

export function stripMarkdownToText(markdown = '') {
  return stripMarkdownSyntax(String(markdown || ''))
    .replace(/\n{2,}/g, '\n')
    .trim();
}
