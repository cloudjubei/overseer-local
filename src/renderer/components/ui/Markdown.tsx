import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkSlug from 'remark-slug'
import rehypeHighlight from 'rehype-highlight'
import RichText from './RichText'

// Helper: render children while converting string nodes into RichText (mentions -> chips)
function InlineWithMentions({ children }: { children: React.ReactNode }) {
  const mapNode = (node: React.ReactNode, idx: number): React.ReactNode => {
    if (typeof node === 'string') return <RichText key={idx} text={node} />
    if (Array.isArray(node)) return node.map((n, i) => mapNode(n, i))
    return node
  }
  if (Array.isArray(children)) return <>{children.map((c, i) => mapNode(c, i))}</>
  return mapNode(children, 0) as React.ReactElement
}

// Code block renderer with horizontal-only scrolling container
function CodeBlock({
  inline,
  className,
  children,
}: {
  inline?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const match = /language-(\w+)/.exec(className || '')
  if (inline) {
    return (
      <code className="px-1 py-[1px] rounded bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)] text-[var(--text-primary)]">
        <InlineWithMentions>{children}</InlineWithMentions>
      </code>
    )
  }
  return (
    <div className="md-scrollbox max-w-full overflow-x-auto overflow-y-hidden my-2 rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)]">
      <pre className="m-0 p-3 whitespace-pre break-normal min-w-fit">
        <code className={[className || '', match ? `language-${match[1]}` : ''].join(' ').trim()}>
          {children}
        </code>
      </pre>
    </div>
  )
}

// Table renderer inside horizontal-only scroll container
function TableWrapper({ children }: { children?: React.ReactNode }) {
  return (
    <div className="md-scrollbox max-w-full overflow-x-auto overflow-y-hidden my-2 rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)]">
      <table className="table-auto w-full min-w-fit text-[13px]">
        {children}
      </table>
    </div>
  )
}

// Image renderer constrained to bubble width
function Img(props: any) {
  return <img {...props} className={[props.className || '', 'max-w-full rounded'].join(' ')} />
}

// Default block element wrapper that preserves mentions
function Block({ as: As, className, children }: { as: any; className?: string; children?: React.ReactNode }) {
  return (
    <As className={className}>
      <InlineWithMentions>{children}</InlineWithMentions>
    </As>
  )
}

export default function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown-body text-[14px] leading-[1.5]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkSlug]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Inline and block code
          code: CodeBlock as any,
          pre: ({ children }) => <>{children}</>,

          // Tables
          table: TableWrapper as any,
          thead: (props) => <thead className="bg-[var(--surface-raised)]" {...props} />,
          th: (props) => (
            <th
              className="text-left font-semibold text-[var(--text-primary)] border-b border-[var(--border-subtle)] px-3 py-2"
              {...props}
            />
          ),
          td: (props) => (
            <td className="align-top border-b border-[var(--border-subtle)] px-3 py-2" {...props} />
          ),

          // Blocks
          p: ({ children }) => (
            <Block as="p" className="my-2 whitespace-pre-wrap break-words">
              {children}
            </Block>
          ),
          ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => (
            <Block as="li" className="my-1">
              {children}
            </Block>
          ),
          blockquote: ({ children }) => (
            <Block
              as="blockquote"
              className="my-2 pl-3 border-l-2 border-[var(--border-subtle)] text-[var(--text-secondary)]"
            >
              {children}
            </Block>
          ),

          // Headings
          h1: ({ children }) => <Block as="h1" className="mt-3 mb-2 text-[18px] font-semibold">{children}</Block>,
          h2: ({ children }) => <Block as="h2" className="mt-3 mb-2 text-[16px] font-semibold">{children}</Block>,
          h3: ({ children }) => <Block as="h3" className="mt-3 mb-2 text-[15px] font-semibold">{children}</Block>,
          h4: ({ children }) => <Block as="h4" className="mt-3 mb-2 text-[14px] font-semibold">{children}</Block>,
          h5: ({ children }) => <Block as="h5" className="mt-3 mb-2 text-[13px] font-semibold">{children}</Block>,
          h6: ({ children }) => <Block as="h6" className="mt-3 mb-2 text-[12px] font-semibold">{children}</Block>,

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[var(--accent-primary)] underline"
            >
              <InlineWithMentions>{children}</InlineWithMentions>
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
