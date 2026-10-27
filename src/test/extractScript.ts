/** Extract an inline script from generated test HTML, not a general HTML sanitizer. */
export function extractScript(html: string): string | undefined {
  // HTML tag names are ASCII case-insensitive. Unicode lowercasing could change
  // string length and invalidate offsets into the original document.
  const lower = html.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
  const openStart = findTagStart(lower, "<script", 0);
  if (openStart === -1) return undefined;

  const openClose = findTagEnd(html, openStart + "<script".length);
  if (openClose === -1) {
    return undefined;
  }
  const contentStart = openClose + 1;

  const closeStart = findTagStart(lower, "</script", contentStart);
  if (closeStart === -1 || findTagEnd(html, closeStart + "</script".length) === -1) {
    return undefined;
  }
  return html.slice(contentStart, closeStart);
}

function findTagStart(html: string, prefix: string, from: number): number {
  let start = html.indexOf(prefix, from);
  while (start !== -1) {
    const next = html[start + prefix.length];
    if (next === ">" || next === "/" || isWhitespace(next)) return start;
    start = html.indexOf(prefix, start + prefix.length);
  }
  return -1;
}

function findTagEnd(html: string, from: number): number {
  let quote: string | undefined;
  for (let index = from; index < html.length; index++) {
    const ch = html[index];
    if (quote !== undefined) {
      if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return index;
    }
  }
  return -1;
}

function isWhitespace(ch: string | undefined): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";
}
