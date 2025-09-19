import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import cron from 'node-cron'
import type TelegramBot from 'node-telegram-bot-api'

vi.mock('node-cron')
vi.mock('../../src/config/env', () => ({ config: { timezone: 'UTC' } }))
vi.mock('../../src/lib/sessionStore')
vi.mock('../../src/lib/backendClient')
vi.mock('../../src/generated/backend')

import { initScheduler, shutdownScheduler, tickSchedulerOnce } from '../../src/lib/scheduler'
import { getAllUserIds, getSession } from '../../src/lib/sessionStore'
import { CheckInsService } from '../../src/generated/backend'

describe('lib/scheduler metadata handling', () => {
  const mockBot = { sendMessage: vi.fn() } as unknown as TelegramBot
  const mockTask = { start: vi.fn(), stop: vi.fn() }

  const now = new Date('2023-05-15T14:30:00Z')
  const checkInTime = new Date('2023-05-15T14:00:00Z')

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(cron.schedule).mockReturnValue(mockTask as any)
    vi.mocked(getAllUserIds).mockReturnValue(['u1'])
    vi.mocked(getSession).mockReturnValue({ userId: 'u1', accessToken: 't1' } as any)
    initScheduler(mockBot)
  })

  afterEach(() => {
    shutdownScheduler()
  })

  it('should derive chatId from metadata.chatId (number) and not update metadata', async () => {
    vi.mocked(CheckInsService.checkInsControllerGetCheckIns).mockResolvedValue({
      items: [
        { id: 'ci1', start: checkInTime.toISOString(), metadata: { message: 'hi', chatId: 999 } },
      ],
    } as any)

    await tickSchedulerOnce(now)

    expect(mockBot.sendMessage).toHaveBeenCalledWith(999, 'hi')
    expect(CheckInsService.checkInsControllerUpdateCheckIn).not.toHaveBeenCalled()
  })

  it('should derive chatId from metadata.chat_id (string) and update metadata to include telegram info', async () => {
    vi.mocked(CheckInsService.checkInsControllerGetCheckIns).mockResolvedValue({
      items: [
        {
          id: 'ci2',
          start: checkInTime.toISOString(),
          metadata: { message: 'yo', chat_id: '123' },
        },
      ],
    } as any)

    await tickSchedulerOnce(now)

    expect(mockBot.sendMessage).toHaveBeenCalledWith(123, 'yo')
    // updateCheckIn is called because telegram.userId is missing
    expect(CheckInsService.checkInsControllerUpdateCheckIn).toHaveBeenCalledWith({
      id: 'ci2',
      requestBody: expect.objectContaining({ metadata: expect.objectContaining({ chatId: 123 }) }),
    })
  })

  it('should derive chatId from metadata.telegram.chat.id and not update if already has telegram.userId', async () => {
    vi.mocked(CheckInsService.checkInsControllerGetCheckIns).mockResolvedValue({
      items: [
        {
          id: 'ci3',
          start: checkInTime.toISOString(),
          metadata: { message: 'hey', telegram: { chat: { id: 456 }, userId: 'u1' } },
        },
      ],
    } as any)

    await tickSchedulerOnce(now)

    expect(mockBot.sendMessage).toHaveBeenCalledWith(456, 'hey')
    expect(CheckInsService.checkInsControllerUpdateCheckIn).not.toHaveBeenCalled()
  })

  it('should skip when chatId cannot be determined', async () => {
    vi.mocked(CheckInsService.checkInsControllerGetCheckIns).mockResolvedValue({
      items: [{ id: 'ci4', start: checkInTime.toISOString(), metadata: { message: 'no chat' } }],
    } as any)

    await tickSchedulerOnce(now)

    expect(mockBot.sendMessage).not.toHaveBeenCalled()
  })
})
