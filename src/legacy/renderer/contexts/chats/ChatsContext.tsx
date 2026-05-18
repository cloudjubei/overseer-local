import { createContext, useContext } from 'react'
import type { ChatsContextValue } from './ChatsTypes'

export const ChatsContext = createContext<ChatsContextValue | null>(null)

export function useChats(): ChatsContextValue {
  const v = useContext(ChatsContext)
  if (!v) throw new Error('useChats must be used within a ChatsProvider')
  return v
}
