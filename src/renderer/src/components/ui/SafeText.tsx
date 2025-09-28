export default function SafeText({ text, className }: { text: string; className?: string }) {
  return (
    <pre className={['whitespace-pre-wrap break-words', className || ''].join(' ')}>{text}</pre>
  )
}
