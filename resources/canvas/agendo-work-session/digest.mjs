import { readFileSync } from 'node:fs';
import { renderNavigation } from './page.mjs';

export function renderDigestCanvas(scope, nav, nonce, csp) {
  if (!['todos', 'code-scanning'].includes(scope)) throw new Error('Invalid digest scope');
  const bootstrap = String.raw`
    (() => {
      // Minimal Markdown renderer: headings, paragraphs, bullet/numbered lists,
      // fenced code, inline bold/italic styles.
      function inlineMarkdown(text) {
        return String(text)
          .replace(new RegExp('\\*\\*(.+?)\\*\\*', 'g'), '<strong>$1</strong>')
          .replace(new RegExp('(^|[^*\\w])\\*(?!\\s)([^*]+?)\\*(?!\\w)', 'g'), '$1<em>$2</em>');
      }
      function renderMarkdown(markdown) {
        const lines = String(markdown).split(new RegExp('\\r?\\n'));
        const out = [];
        let paragraph = [];
        let list = null;
        let fence = null;
        const flushParagraph = () => {
          if (paragraph.length) out.push('<p>' + inlineMarkdown(paragraph.join(' ')) + '</p>');
          paragraph = [];
        };
        const flushList = () => {
          if (list) out.push('<' + list.tag + '>' + list.items.map(i => '<li>' + inlineMarkdown(i) + '</li>').join('') + '</' + list.tag + '>');
          list = null;
        };
        for (const line of lines) {
          if (fence !== null) {
            if (line.trim().startsWith('\`\`\`')) {
              out.push('<pre><code>' + fence.join('\n') + '</code></pre>');
              fence = null;
            } else {
              fence.push(line);
            }
            continue;
          }
          if (line.trim().startsWith('\`\`\`')) {
            flushParagraph();
            flushList();
            fence = [];
            continue;
          }
          const heading = line.match(new RegExp('^(#{1,6})\\s+(.+)$'));
          const bullet = line.match(new RegExp('^\\s*[-*]\\s+(.+)$'));
          const ordered = line.match(new RegExp('^\\s*\\d+\\.\\s+(.+)$'));
          if (heading) {
            flushParagraph();
            flushList();
            const level = Math.max(3, heading[1].length);
            out.push('<h' + level + '>' + inlineMarkdown(heading[2]) + '</h' + level + '>');
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
        if (fence !== null) out.push('<pre><code>' + fence.join('\n') + '</code></pre>');
        flushParagraph();
        flushList();
        return out.join('');
      }

      const scope = ${JSON.stringify(scope)};
      const status = document.createElement('p');
      status.className = 'error';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      document.body.append(status);
      const refresh = async () => {
        try {
          const response = await fetch('/digest-snapshot');
          if (!response.ok) throw new Error(await response.text());
          const digest = await response.json();
          const container = document.getElementById('digest-content');
          if (container) {
            container.innerHTML = '';
            const div = document.createElement('div');
            div.className = 'digest-markdown';
            div.innerHTML = renderMarkdown(digest.content);
            container.appendChild(div);
          }
        } catch (error) {
          status.textContent = 'Could not load digest: ' + error.message;
        }
      };
      setInterval(refresh, 5000);
      refresh();
      const open = async (path, payload) => {
        try {
          const response = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
            body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error(await response.text());
          location.reload();
        } catch (error) {
          status.textContent = 'Could not navigate: ' + error.message;
        }
      };
      for (const button of document.querySelectorAll('[data-nav]')) {
        button.addEventListener('click', () => open('/nav', { direction: button.dataset.nav }));
      }
      for (const button of document.querySelectorAll('[data-open]')) {
        button.addEventListener('click', () => open('/open', { todoId: button.dataset.open }));
      }
      for (const button of document.querySelectorAll('[data-open-board]')) {
        button.addEventListener('click', () => open('/open', { view: { kind: 'board', scope: button.dataset.openBoard } }));
      }
      for (const button of document.querySelectorAll('[data-open-digest]')) {
        button.addEventListener('click', () => open('/open', { view: { kind: 'digest', scope: button.dataset.openDigest } }));
      }
      // Clicking a todo reference in the digest opens that todo in the canvas.
      for (const link of document.querySelectorAll('a[href^="/open/"]')) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const href = link.getAttribute('href');
          const todoId = href?.split('/').pop();
          if (todoId) open('/open', { todoId });
        });
      }
    })();
  `;
  const navigation = `<div class="canvas-toolbar">${renderNavigation(nav)}</div>`;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agendo Task Digest</title>
  <link rel="stylesheet" href="/page.css">
  <style>
    .digest-markdown {
      font-family: inherit;
      font-size: 0.95rem;
      line-height: 1.6;
      margin: 0;
      padding: 1rem;
      background: var(--bg-secondary, #252525);
      color: var(--fg-secondary, #d4d4d4);
      border-radius: 6px;
      border: 1px solid var(--border, #3a3a3a);
    }
    .digest-markdown h3 {
      margin-top: 1rem;
      margin-bottom: 0.5rem;
      font-size: 1.1rem;
    }
    .digest-markdown ul,
    .digest-markdown ol {
      margin: 0.5rem 0;
      padding-left: 1.5rem;
    }
    .digest-markdown li {
      margin-bottom: 0.25rem;
    }
    .digest-markdown strong {
      font-weight: bold;
    }
  </style>
</head>
<body>
  ${navigation}
  <main class="digest-view">
    <h1>Task Digest</h1>
    <div id="digest-content"></div>
  </main>
  <script nonce="${nonce}">${bootstrap}</script>
</body>
</html>`;
  return html;
}
