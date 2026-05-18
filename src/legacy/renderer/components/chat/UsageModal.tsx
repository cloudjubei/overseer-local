import type { CompletionMessage } from 'thefactory-tools'

import { UsageModal as UsageModalBase } from 'thefactory-ui/web'
import { getPrice } from '@renderer/services/pricingService'
import { useCosts } from '@renderer/contexts/CostsContext'

export type UsageModalProps = {
  isOpen: boolean
  onClose: () => void
  messages: CompletionMessage[]
  chatKey?: string
}

export default function UsageModal({ isOpen, onClose, messages, chatKey }: UsageModalProps) {
  const { getCost } = useCosts()
  return (
    <UsageModalBase
      isOpen={isOpen}
      onClose={onClose}
      messages={messages}
      chatKey={chatKey}
      getPrice={getPrice}
      getCost={getCost}
    />
  )
}
