import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import { renderToStaticMarkup } from 'react-dom/server';
import DOMPurify from 'dompurify';
import 'highlight.js/styles/github.css';

interface MarkdownRendererProps {
  content: string;
}

// Build a sanitize schema that allows GFM tables and code classes for syntax highlighting
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
    ],
    img: [
      ...(defaultSchema.attributes?.img || []),
      ['src'],
      ['alt'],
      ['title'],
      ['width'],
      ['height'],
      ['loading'],
    ],
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
  'class', 'title', 'lang', 'dir',
  // anchors
  'href', 'name', 'target', 'rel',
  // images
  'src', 'alt', 'width', 'height', 'loading'
];

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const sanitizedHtml = useMemo(() => {
    // Render markdown to static HTML string using the same plugins/components
    const element = (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema as any], [rehypeHighlight, { detect: true }]]}
        components={{
          a: (props) => {
            const { children, href, ...rest } = props as any;
            const isExternal = href && /^(https?:)?\/\//i.test(href);
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

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
  );
};

export default MarkdownRenderer;
