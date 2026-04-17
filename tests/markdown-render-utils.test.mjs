import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMarkdownToHtml, stripMarkdownToText } from '../js/markdown-render-utils.mjs';

test('renderMarkdownToHtml supports headings, bold text, lists, and line breaks', () => {
  const html = renderMarkdownToHtml(`# **Title**\n\n**Advisors:** **A**  \n**Framework:** Text\n\n* first\n* second`);

  assert.match(html, /<h1><strong>Title<\/strong><\/h1>/);
  assert.match(html, /<p><strong>Advisors:<\/strong> <strong>A<\/strong><br><strong>Framework:<\/strong> Text<\/p>/);
  assert.match(html, /<ul><li>first<\/li><li>second<\/li><\/ul>/);
});

test('renderMarkdownToHtml preserves explicit single-line breaks inside paragraphs', () => {
  const html = renderMarkdownToHtml('Line one\nLine two\nLine three');

  assert.match(html, /<p>Line one<br>Line two<br>Line three<\/p>/);
});

test('renderMarkdownToHtml escapes HTML while preserving markdown emphasis', () => {
  const html = renderMarkdownToHtml('**Safe** <script>alert(1)</script>');

  assert.match(html, /<strong>Safe<\/strong>/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('stripMarkdownToText removes markdown syntax for metadata text', () => {
  const text = stripMarkdownToText('# **Title**\n\n* first\n* second');

  assert.equal(text, 'Title\nfirst\nsecond');
});
