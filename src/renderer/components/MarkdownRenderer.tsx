import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

// Placeholder Markdown renderer: shows raw content inside a preformatted block.
// Full-featured Markdown rendering with GFM, syntax highlighting, and sanitization
// will be added in a later feature to avoid introducing new dependencies now.
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose dark:prose-invert max-w-none p-4">
      <pre className="whitespace-pre-wrap text-sm leading-6">{content}</pre>
    </div>
  );
};

export default MarkdownRenderer;
