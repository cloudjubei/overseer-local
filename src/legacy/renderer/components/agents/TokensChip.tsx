import { useMemo } from 'react'
import { TokensChip as TokensChipBase } from 'thefactory-ui/web'
import type { Chat } from 'thefactory-tools'

export default function TokensChip({ run }: { run: Chat }) {
  const { prompt, completion, userMessages, assistantMessages } = useMemo(() => {
    let prompt = 0
    let completion = 0
    let userMessages = 0
    let assistantMessages = 0
    for (const m of run.messages) {
      const role = String((m as { role?: string }).role ?? '').toLowerCase()
      if (role === 'user') userMessages += 1
      if (role === 'assistant') {
        assistantMessages += 1
        const usage = (m as { usage?: { promptTokens?: number; completionTokens?: number } }).usage
        prompt += usage?.promptTokens ?? 0
        completion += usage?.completionTokens ?? 0
      }
    }
    return { prompt, completion, userMessages, assistantMessages }
  }, [run.messages])

  return (
    <TokensChipBase
      prompt={prompt}
      completion={completion}
      averages={{
        userMessages,
        assistantMessages,
        avgPromptPerUser: userMessages > 0 ? Math.round(prompt / userMessages) : undefined,
        avgCompletionPerAssistant:
          assistantMessages > 0 ? Math.round(completion / assistantMessages) : undefined,
      }}
    />
  )
}
