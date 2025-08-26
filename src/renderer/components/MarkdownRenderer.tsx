import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import 'highlight.js/styles/github.css';

interface MarkdownRendererProps {
  content: string;
}

// Build a safe sanitization schema that preserves GFM tables and code highlighting
const buildSanitizeSchema = () => {
  // Deep clone the default schema to avoid mutation
  const schema: any = JSON.parse(JSON.stringify(defaultSchema || {}));

  // Ensure attributes map exists
  schema.attributes = schema.attributes || {};

  // Allow className globally (needed for highlight.js and general styling)
  const globalAttrs = new Set([...(schema.attributes['*'] || []), 'className', 'id']);
  schema.attributes['*'] = Array.from(globalAttrs);

  // Allow link-related safe attributes
  const linkAttrs = new Set([...(schema.attributes.a || []), 'target', 'rel']);
  schema.attributes.a = Array.from(linkAttrs);

  // Allow basic image attributes
  const imgAttrs = new Set([...(schema.attributes.img || []), 'loading', 'decoding']);
  schema.attributes.img = Array.from(imgAttrs);

  // Preserve code highlighting classes
  const codeAttrs = new Set([...(schema.attributes.code || []), 'className']);
  schema.attributes.code = Array.from(codeAttrs);
  const preAttrs = new Set([...(schema.attributes.pre || []), 'className']);
  schema.attributes.pre = Array.from(preAttrs);
  const spanAttrs = new Set([...(schema.attributes.span || []), 'className']);
  schema.attributes.span = Array.from(spanAttrs);

  // Allow table-related tags/attributes for GFM
  const thAttrs = new Set([...(schema.attributes.th || []), 'align', 'colSpan', 'rowSpan']);
  schema.attributes.th = Array.from(thAttrs);
  const tdAttrs = new Set([...(schema.attributes.td || []), 'align', 'colSpan', 'rowSpan']);
  schema.attributes.td = Array.from(tdAttrs);

  // If tagNames whitelist exists, ensure common GFM/formatting tags are included
  if (Array.isArray(schema.tagNames)) {
    const extraTags = [
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'pre',
      'code',
      'span',
      'del'
    ];
    const tagSet = new Set([...(schema.tagNames || []), ...extraTags]);
    schema.tagNames = Array.from(tagSet);
  }

  return schema;
};

const sanitizeSchema = buildSanitizeSchema();

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose dark:prose-invert max-w-none p-4">
      <ReactMarkdown
        // GitHub Flavored Markdown (tables, task lists, strikethrough, etc.)
        remarkPlugins={[remarkGfm]}
        // Rehype pipeline: parse raw HTML -> sanitize -> highlight
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema],
          rehypeHighlight,
        ]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
