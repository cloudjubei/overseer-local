import React, { useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkSlug from 'remark-slug';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import { renderToStaticMarkup } from 'react-dom/server';
import DOMPurify from 'dompurify';
import 'highlight.js/styles/github.css';

interface MarkdownRendererProps {
  content: string;
  // Relative path of the current markdown file under docs/
  currentRelPath?: string | null;
  // Navigate to another markdown file (under docs/) optionally with a fragment id
  onNavigateDoc?: (relPath: string, fragment?: string | null) => void;
  // If provided, scroll to this element id after render
  scrollToId?: string | null;
}

// Build a sanitize schema that allows GFM tables, code classes, and id attributes for headings
const schema = {
  ...defaultSchema,
  attributes: {
    ...(defaultSchema.attributes || {}),
    code: [
      ...(defaultSchema.attributes?.code || []),
      ['className'], // allow language-xyz and hljs classes
    ],
    span: [
      ...(defaultSchema.attributes?.span || []),
      ['className'],
    ],
    pre: [
      ...(defaultSchema.attributes?.pre || []),
      ['className'],
    ],
    table: [...(defaultSchema.attributes?.table || [])],
    thead: [...(defaultSchema.attributes?.thead || [])],
    tbody: [...(defaultSchema.attributes?.tbody || [])],
    tr: [...(defaultSchema.attributes?.tr || [])],
    th: [...(defaultSchema.attributes?.th || [])],
    td: [...(defaultSchema.attributes?.td || [])],
    a: [
      ...(defaultSchema.attributes?.a || []),
      ['target'],
      ['rel'],
      ['title'],
      ['href'],
      ['name'],
      ['id'],
    ],
    h1: [...(defaultSchema.attributes?.h1 || []), ['id']],
    h2: [...(defaultSchema.attributes?.h2 || []), ['id']],
    h3: [...(defaultSchema.attributes?.h3 || []), ['id']],
    h4: [...(defaultSchema.attributes?.h4 || []), ['id']],
    h5: [...(defaultSchema.attributes?.h5 || []), ['id']],
    h6: [...(defaultSchema.attributes?.h6 || []), ['id']],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'table', 'thead', 'tbody', 'tr', 'th', 'td'
  ],
};

const ALLOWED_TAGS = [
  'a', 'abbr', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'hr', 'i', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'sub', 'sup', 'u', 'ul',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img'
];
const ALLOWED_ATTR = [
  'class', 'title', 'lang', 'dir', 'id',
  // anchors
  'href', 'name', 'target', 'rel',
  // images
  'src', 'alt', 'width', 'height', 'loading'
];

// Small path utilities for resolving relative links within docs/
function dirname(p: string): string {
  const idx = p.lastIndexOf('/');
  return idx === -1 ? '' : p.slice(0, idx);
}
function normalizePath(p: string): string {
  const parts = p.split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop(); else stack.push(part);
  }
  return stack.join('/');
}
function resolveRel(baseRelPath: string, hrefPath: string): string {
  if (!hrefPath) return baseRelPath;
  if (hrefPath.startsWith('/')) {
    // treat as docs-root absolute path, strip leading slash
    return normalizePath(hrefPath.replace(/^\/+/, ''));
  }
  const baseDir = dirname(baseRelPath);
  const combined = baseDir ? baseDir + '/' + hrefPath : hrefPath;
  return normalizePath(combined);
}
function isExternalHref(href?: string | null): boolean {
  if (!href) return false;
  return /^(https?:|mailto:|tel:|ftp:)?\/\//i.test(href) || /^(https?:|mailto:|tel:|ftp:)/i.test(href);
}

// CSS escape polyfill (minimal) for id selectors
function cssEscapeIdent(id: string): string {
  // Basic escape for special characters
  return id.replace(/([!"#$%&'()*+,./:;<=>?@\[\]^`{|}~ ])/g, '\\$1');
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, currentRelPath, onNavigateDoc, scrollToId }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const sanitizedHtml = useMemo(() => {
    // Render markdown to static HTML string using the same plugins/components
    const element = (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkSlug]}
        rehypePlugins={[[rehypeSanitize, schema as any], [rehypeHighlight, { detect: true }]]}
        components={{
          a: (props) => {
            const { children, href, ...rest } = props as any;
            const isExternal = href && isExternalHref(href);
            return (
              <a href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer noopener' : undefined} {...rest}>
                {children}
              </a>
            );
          },
          code: ({ className, children, ...rest }) => {
            const cn = className || '';
            return (
              <code className={cn} {...rest}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
    const rawHtml = renderToStaticMarkup(element);

    // Sanitize with DOMPurify to enforce safe tags/attributes and eliminate XSS
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      // Keep URI-safe links only (DOMPurify already strips javascript: and other dangerous URLs)
      USE_PROFILES: { html: true },
    });
    return cleanHtml;
  }, [content]);

  // Click interception for internal navigation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href) return;

      // External links: let default occur (we already set target=_blank)
      if (isExternalHref(href)) return;

      // Internal navigation
      e.preventDefault();

      // Split href into path and fragment
      const hashIdx = href.indexOf('#');
      const hrefPath = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
      const fragment = hashIdx >= 0 ? href.slice(hashIdx + 1) : '';

      const isAnchorOnly = hrefPath === '' || href.startsWith('#');
      if (isAnchorOnly) {
        // Scroll within the current document
        const id = decodeURIComponent(fragment || '');
        if (id) {
          const targetEl = el.querySelector(`#${cssEscapeIdent(id)}`) as HTMLElement | null;
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        return;
      }

      // .md relative file links
      if (/\.md$/i.test(hrefPath)) {
        const base = currentRelPath || '';
        const resolved = resolveRel(base, hrefPath);
        if (onNavigateDoc) {
          onNavigateDoc(resolved, fragment || null);
        }
        return;
      }

      // Non-md relative links: allow default behavior (could be images in markdown renderer)
    };

    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('click', onClick);
    };
  }, [currentRelPath, onNavigateDoc]);

  // Scroll to an anchor id when requested or when content changes
  useEffect(() => {
    if (!scrollToId) return;
    const el = containerRef.current;
    if (!el) return;
    const id = decodeURIComponent(scrollToId);
    const target = el.querySelector(`#${cssEscapeIdent(id)}`) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Try named anchors as a fallback
      const named = el.querySelector(`a[name="${cssEscapeIdent(id)}"]`) as HTMLElement | null;
      if (named) named.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [sanitizedHtml, scrollToId]);

  return (
    <div
      ref={containerRef}
      className="prose prose-neutral dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

export default MarkdownRenderer;
