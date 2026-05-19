import type { ChatMessage } from 'thefactory-ui/headless/api'
import { UsageModal as UsageModalBase } from 'thefactory-ui/web'
import { useCosts } from '@core/contexts/CostsContext'
import { getPrice } from '@services/pricingService'

export type UsageModalProps = {
  isOpen: boolean
  onClose: () => void
  messages: ChatMessage[]
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
