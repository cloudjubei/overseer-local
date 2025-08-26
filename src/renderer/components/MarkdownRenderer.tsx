import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
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
      // Allow className for language-xyz
      ['className'],
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
    ],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'table', 'thead', 'tbody', 'tr', 'th', 'td'
  ],
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeSanitize, schema as any],
          // Highlight.js will add classes like hljs language-xxx
          [rehypeHighlight, { detect: true }],
        ]}
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
    </div>
  );
};

export default MarkdownRenderer;
