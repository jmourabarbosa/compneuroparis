function updateTextareaValue(textarea, value, selectionStart, selectionEnd) {
  textarea.value = value;
  textarea.focus();
  textarea.setSelectionRange(selectionStart, selectionEnd);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function wrapSelection(textarea, before, after, placeholder) {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const value = textarea.value || '';
  const selected = value.slice(start, end) || placeholder;
  const nextValue = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
  const selectionStart = start + before.length;
  const selectionEnd = selectionStart + selected.length;
  updateTextareaValue(textarea, nextValue, selectionStart, selectionEnd);
}

function prefixSelectedLines(textarea, prefix, placeholder) {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const value = textarea.value || '';
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIndex = value.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const selectedBlock = value.slice(lineStart, lineEnd) || placeholder;
  const updatedBlock = selectedBlock
    .split('\n')
    .map(line => line ? `${prefix}${line}` : prefix.trimEnd())
    .join('\n');
  const nextValue = `${value.slice(0, lineStart)}${updatedBlock}${value.slice(lineEnd)}`;
  updateTextareaValue(textarea, nextValue, lineStart, lineStart + updatedBlock.length);
}

function applyMarkdownAction(textarea, action) {
  switch (action) {
    case 'bold':
      wrapSelection(textarea, '**', '**', 'bold text');
      break;
    case 'italic':
      wrapSelection(textarea, '*', '*', 'italic text');
      break;
    case 'heading':
      prefixSelectedLines(textarea, '# ', 'Heading');
      break;
    case 'bullet':
      prefixSelectedLines(textarea, '* ', 'List item');
      break;
    default:
      break;
  }
}

export function initMarkdownToolbars(root = document) {
  root.querySelectorAll('[data-md-action][data-md-target]').forEach((button) => {
    if (button.dataset.mdBound === 'true') {
      return;
    }

    button.dataset.mdBound = 'true';
    button.addEventListener('click', () => {
      const targetId = button.dataset.mdTarget;
      const textarea = root.getElementById
        ? root.getElementById(targetId)
        : document.getElementById(targetId);
      if (!textarea) {
        return;
      }

      applyMarkdownAction(textarea, button.dataset.mdAction);
    });
  });
}
