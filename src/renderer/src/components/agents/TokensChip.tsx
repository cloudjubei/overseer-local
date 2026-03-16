import { useMemo } from 'react'
import Tooltip from '../ui/Tooltip'
import { IconArrowLeftMini, IconArrowRightMini } from '../ui/icons/Icons'
import type { Chat } from 'thefactory-tools'

export default function TokensChip({ run }: { run: Chat }) {
  const prompt = useMemo(
    () =>
      run.messages
        .map((m: any) => (m?.role === 'assistant' ? m?.usage?.promptTokens ?? 0 : 0))
        .reduce((acc, c) => acc + c, 0),
    [run.messages],
  )
  const completion = useMemo(
    () =>
      run.messages
        .map((m: any) => (m?.role === 'assistant' ? m?.usage?.completionTokens ?? 0 : 0))
        .reduce((acc, c) => acc + c, 0),
    [run.messages],
  )

  const { userCount, assistantCount, avgPromptPerMsg, avgCompletionPerMsg } = useMemo(() => {
    const messages = run.messages
    const userCount = messages.filter(
      (m: any) => String(m?.role || '').toLowerCase() === 'user',
    ).length
    const assistantCount = messages.filter(
      (m: any) => String(m?.role || '').toLowerCase() === 'assistant',
    ).length
    const avgPromptPerMsg = userCount > 0 ? Math.round(prompt / userCount) : undefined
    const avgCompletionPerMsg =
      assistantCount > 0 ? Math.round(completion / assistantCount) : undefined
    return { userCount, assistantCount, avgPromptPerMsg, avgCompletionPerMsg }
  }, [run.messages, prompt, completion])

  const content = (
    <div className="text-xs max-w-[360px]">
      <div className="font-semibold mb-1">Token usage</div>
      <div className="mb-1 text-neutral-400">
        Prompt: {prompt} · Completion: {completion} · Total: {prompt + completion}
      </div>
      <div className="mb-2">
        <div className="text-neutral-600 dark:text-neutral-300">Per-message averages</div>
        <div className="text-neutral-400">
          User ({userCount || 0}): {avgPromptPerMsg != null ? `${avgPromptPerMsg} tokens/msg` : '—'}{' '}
          · Assistant ({assistantCount || 0}):{' '}
          {avgCompletionPerMsg != null ? `${avgCompletionPerMsg} tokens/msg` : '—'}
        </div>
      </div>
    </div>
  )

  return (
    <Tooltip content={content} placement="top">
      <span className="inline-flex flex-col items-start gap-0.5 rounded-full border px-2 py-0.5 text-xs font-medium bg-neutral-50 text-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700 leading-3">
        <span className="flex items-center gap-1">
          <IconArrowLeftMini className="text-neutral-400 h-[16px] w-[16px]" />
          <span>{prompt}</span>
        </span>
        <span className="flex items-center gap-1">
          <IconArrowRightMini className="text-neutral-400 h-[16px] w-[16px]" />
          <span>{completion}</span>
        </span>
      </span>
    </Tooltip>
  )
}
