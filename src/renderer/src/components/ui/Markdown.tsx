import { FC, memo } from 'react'
import ReactMarkdown, { Options, type Components } from 'react-markdown'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { cn } from '../../utils/utils'

export const components: Partial<Components> = {
  pre: ({ node, children, ...props }) => {
    // Add styling for code blocks
    return (
      <pre className="bg-muted p-4 rounded-md overflow-x-auto my-4" {...props}>
        {children}
      </pre>
    )
  },
  code: (props) => {
    const { node, children, className, ...rest } = props
    // Handle code blocks within pre tags
    // Check if the parent is a 'pre' element
    const match = /language-(\w+)/.exec(className || '')
    if (match) {
      // We are inside a pre block, potentially with a language
      // Syntax highlighting could be added here later if needed
      // For now, just render the children without extra styling
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      )
    }

    // Fallback for standalone code tags not inside 'pre'
    // This case is less common in standard Markdown
    return (
      <code
        className={cn(className, 'bg-muted p-1 rounded text-sm font-mono block break-words')}
        {...rest}
      >
        {children}
      </code>
    )
  },
  p: ({ node, children, ...props }) => {
    // Add consistent bottom margin to paragraphs
    return (
      <div className="my-1 leading-relaxed" {...props}>
        {children}
      </div>
    )
  },
  ol: ({ node, children, ...props }) => {
    return (
      <ol className="list-decimal list-outside ml-6 mb-4 space-y-1" {...props}>
        {children}
      </ol>
    )
  },
  ul: ({ node, children, ...props }) => {
    return (
      <ul className="list-disc list-outside ml-6 mb-4 space-y-1" {...props}>
        {children}
      </ul>
    )
  },
  li: ({ node, children, ...props }) => {
    return (
      <li className="mb-1" {...props}>
        {children}
      </li>
    )
  },
  table: ({ node, children, ...props }) => {
    return (
      <div className="overflow-x-auto w-full my-4 border rounded-md">
        <table className="w-full text-sm" {...props}>
          {children}
        </table>
      </div>
    )
  },
  thead: ({ node, children, ...props }) => {
    return (
      <thead className="bg-muted/50" {...props}>
        {children}
      </thead>
    )
  },
  th: ({ node, children, ...props }) => {
    // Add styling for table headers - ensure left alignment
    return (
      <th
        className="p-3 border-b border-r text-left font-medium text-muted-foreground last:border-r-0"
        {...props}
      >
        {children}
      </th>
    )
  },
  td: ({ node, children, ...props }) => {
    // Add styling for table data cells - ensure left alignment
    return (
      <td className="p-3 border-b border-r text-left last:border-r-0" {...props}>
        {children}
      </td>
    )
  },
  tr: ({ node, children, ...props }) => {
    // Add styling for table rows
    return (
      <tr
        className="even:bg-muted/30 hover:bg-muted/50 transition-colors last:border-b-0"
        {...props}
      >
        {children}
      </tr>
    )
  },
  strong: ({ node, children, ...props }) => {
    return (
      <strong className="font-semibold" {...props}>
        {children}
      </strong>
    )
  },
  a: ({ node, children, ...props }) => {
    return (
      <a className="text-blue-500 hover:underline" target="_blank" rel="noreferrer" {...props}>
        {children}
      </a>
    )
  },
  h1: ({ node, children, ...props }) => {
    return (
      <h1 className="text-2xl font-bold mt-4 mb-2 pb-1 border-b" {...props}>
        {children}
      </h1>
    )
  },
  h2: ({ node, children, ...props }) => {
    return (
      <h2 className="text-1xl font-semibold mt-4 mb-2 pb-1 border-b" {...props}>
        {children}
      </h2>
    )
  },
  h3: ({ node, children, ...props }) => {
    return (
      <h3 className="text-xl font-semibold" {...props}>
        {children}
      </h3>
    )
  },
  h4: ({ node, children, ...props }) => {
    return (
      <h4 className="text-lg font-semibold" {...props}>
        {children}
      </h4>
    )
  },
  h5: ({ node, children, ...props }) => {
    return (
      <h5 className="text-base font-semibold" {...props}>
        {children}
      </h5>
    )
  },
  h6: ({ node, children, ...props }) => {
    return (
      <h6 className="text-sm font-semibold" {...props}>
        {children}
      </h6>
    )
  },
}

export const MemoizedReactMarkdown: FC<Options> = memo(
  ReactMarkdown as FC<Options>,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
)

export default function Markdown({ text }: { text: string }) {
  const containsLaTeX = isContainingLaTeX(text)
  const processedText = containsLaTeX ? preprocessLaTeX(text || '') : text
  return (
    <MemoizedReactMarkdown
      rehypePlugins={[
        rehypeRaw,
        [rehypeExternalLinks, { target: '_blank' }],
        ...(containsLaTeX ? [rehypeKatex] : []),
      ]}
      remarkPlugins={[remarkGfm, ...(containsLaTeX ? [remarkMath] : [])]}
      components={components}
    >
      {processedText}
    </MemoizedReactMarkdown>
  )
}

export function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div
        className="markdown-content prose prose-sm max-w-none prose-slate dark:prose-invert
            prose-table:border-collapse
            prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-700 prose-th:bg-gray-100 dark:prose-th:bg-gray-800 prose-th:p-2
            prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-700 prose-td:p-2
            prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-700 prose-blockquote:pl-4 prose-blockquote:text-gray-700 dark:prose-blockquote:text-gray-300
            [&_blockquote_p:first-of-type]:before:content-none [&_blockquote_p:last-of-type]:after:content-none
            [&_table]:w-full [&_table]:overflow-x-auto [&_table]:block [&_table]:max-w-full"
      >
        <Markdown text={text} />
      </div>
    </div>
  )
}

const isContainingLaTeX = (content: string) => {
  return /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/.test(content || '')
}

const preprocessLaTeX = (content: string) => {
  const blockProcessedContent = content.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_, equation) => `$$${equation}$$`,
  )
  const inlineProcessedContent = blockProcessedContent.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_, equation) => `$${equation}$`,
  )
  return inlineProcessedContent
}
