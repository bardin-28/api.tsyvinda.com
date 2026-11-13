import sanitizeHtml from 'sanitize-html';
import { PAGE_LINK_HREF_PREFIX, isPageKey, type PageKey } from '@tsyvinda/shared-types';

/**
 * Rich text editors may write: paragraphs, headings, lists, emphasis, links and quotes. Links
 * may point to http(s), mailto, tel or another page (`page:<key>`, resolved on read). External
 * links get `rel="noopener noreferrer"`.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'h2',
    'h3',
    'h4',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
    'hr',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel', PAGE_LINK_HREF_PREFIX.slice(0, -1)],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, sourceAttribs) => {
      const href = sourceAttribs.href ?? '';
      const external = /^https?:/i.test(href);
      const attribs: sanitizeHtml.Attributes = external
        ? { href, target: '_blank', rel: 'noopener noreferrer' }
        : { href };
      return { tagName, attribs };
    },
  },
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}

/** True when the HTML has no visible text (e.g. "<p></p>"). */
export function isRichTextEmpty(html: string): boolean {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim() === '';
}

const PAGE_HREF = /href="page:([a-z0-9-]+)(#[a-z0-9-]*)?"/g;

/**
 * Replaces `href="page:<key>"` with the page's public path in the reading language (or "#" when
 * that page is not published there), keeping an optional `#anchor`.
 */
export function resolvePageLinks(
  html: string,
  publicPath: (key: PageKey) => string | null,
): string {
  return html.replace(PAGE_HREF, (_match, key: string, hash: string | undefined) => {
    const path = isPageKey(key) ? publicPath(key) : null;
    return `href="${path ? `${path}${hash ?? ''}` : '#'}"`;
  });
}

/** Page keys linked from the HTML (to know which pages a rich text depends on). */
export function linkedPageKeys(html: string): PageKey[] {
  const keys = new Set<PageKey>();
  for (const match of html.matchAll(PAGE_HREF)) {
    if (isPageKey(match[1])) keys.add(match[1]);
  }
  return [...keys];
}
