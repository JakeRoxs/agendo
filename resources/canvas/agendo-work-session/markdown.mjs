export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function inlineMarkdown(text) {
  return String(text)
    .split(/(\[[^\]]+\]\((?:<[^>]*>|https?:\/\/[^)\s]+|\/[^)\s]+)\)|`[^`]+`)/)
    .map(part => {
      const link = part.match(/^\[([^\]]+)\]\((<[^>]*>|https?:\/\/[^)\s]+|\/[^)\s]+)\)$/);
      if (link) {
        const destination = link[2].replace(/^<([^>]*)>$/, '$1');
        return `<a href="${escapeHtml(destination)}" target="_blank" rel="noopener noreferrer">${inlineMarkdown(link[1])}</a>`;
      }
      if (part.startsWith('`') && part.endsWith('`')) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      return escapeHtml(part)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g, '$1<em>$2</em>');
    })
    .join('');
}

// Minimal Markdown subset: headings, paragraphs, bullet/numbered lists, fenced code, inline styles.
export function renderMarkdown(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const out = [];
  let paragraph = [];
  let list = null;
  let fence = null;

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map(i => `<li>${inlineMarkdown(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };

  for (const line of lines) {
    if (fence !== null) {
      if (/^```/.test(line.trim())) {
        out.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`);
        fence = null;
      } else {
        fence.push(line);
      }
      continue;
    }
    if (/^```/.test(line.trim())) {
      flushParagraph();
      flushList();
      fence = [];
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
       const level = Math.max(3, heading[1].length);
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (bullet || ordered) {
      flushParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push((bullet || ordered)[1]);
    } else if (line.trim() === '') {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  if (fence !== null) out.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`);
  flushParagraph();
  flushList();
  return out.join('');
}
