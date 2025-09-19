import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import cron from 'node-cron'
import type TelegramBot from 'node-telegram-bot-api'

// Mock dependencies
vi.mock('node-cron')
vi.mock('../../src/config/env', () => ({ config: { timezone: 'UTC' } }))
vi.mock('../../src/lib/sessionStore')
vi.mock('../../src/lib/backendClient')
vi.mock('../../src/generated/backend')
vi.mock('../../src/lib/backendClient')

import {
  initScheduler,
  shutdownScheduler,
  tickSchedulerOnce,
  currentHourStamp,
  sameHourOfDay,
  getMessageFromMetadata,
} from '../../src/lib/scheduler'
import { getAllUserIds, getSession } from '../../src/lib/sessionStore'
import { CheckInsService } from '../../src/generated/backend'
import { configureBackendClient } from '../../src/lib/backendClient'

describe('lib/scheduler', () => {
  const mockBot = { sendMessage: vi.fn() } as unknown as TelegramBot
  const mockTask = { start: vi.fn(), stop: vi.fn() }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(cron.schedule).mockReturnValue(mockTask as any)
    // Manually init to set botRef, but tests will call tickSchedulerOnce directly
    initScheduler(mockBot)
  })

  afterEach(() => {
    shutdownScheduler()
  })

  describe('initScheduler and shutdownScheduler', () => {
    it('should initialize and start a cron job', () => {
      expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function), {
        timezone: 'UTC',
      })
      expect(mockTask.start).toHaveBeenCalled()
    })

    it('should not initialize a new job if one is already running', () => {
      initScheduler(mockBot) // Second call
      expect(cron.schedule).toHaveBeenCalledTimes(1)
    })

    it('should stop the scheduled task on shutdown', () => {
      shutdownScheduler()
      expect(mockTask.stop).toHaveBeenCalled()
    })
  })

  describe('helper functions', () => {
    it('currentHourStamp should format correctly', () => {
      const d = new Date('2023-01-05T09:30:00.000Z')
      expect(currentHourStamp(d)).toBe('2023010509')
    })

    it('sameHourOfDay should compare hours correctly', () => {
      expect(sameHourOfDay(new Date('2023-01-01T10:00:00'), new Date('2023-05-10T10:59:59'))).toBe(
        true,
      )
      expect(sameHourOfDay(new Date('2023-01-01T10:00:00'), new Date('2023-01-01T11:00:00'))).toBe(
        false,
      )
    })

    it('getMessageFromMetadata', () => {
      expect(getMessageFromMetadata({ message: ' a ' })).toBe('a')
      expect(getMessageFromMetadata({ text: 'b' })).toBe('b')
      expect(getMessageFromMetadata({ content: 'c' })).toBe('c')
      expect(getMessageFromMetadata({ msg: 'd' })).toBe('d')
      expect(getMessageFromMetadata({ other: 'e' })).toBeUndefined()
      expect(getMessageFromMetadata({})).toBeUndefined()
      expect(getMessageFromMetadata(undefined)).toBeUndefined()
      expect(getMessageFromMetadata({ message: '  ' })).toBeUndefined()
      expect(getMessageFromMetadata({ message: 123 })).toBeUndefined()
    })
  })

  describe('tickSchedulerOnce', () => {
    const now = new Date('2023-05-15T14:30:00Z') // 14:30 UTC
    const checkInTime = new Date('2023-05-15T14:00:00Z') // 14:00 UTC

    beforeEach(() => {
      vi.mocked(getAllUserIds).mockReturnValue(['user1'])
      vi.mocked(getSession).mockImplementation((userId) => {
        if (userId === 'user1') return { userId: 'user1', accessToken: 'token1' }
        if (userId === 'user2') return { userId: 'user2', accessToken: 'token2' }
        return undefined
      })
    })

    it('should do nothing if no users are found', async () => {
      vi.mocked(getAllUserIds).mockReturnValue([])
      await tickSchedulerOnce(now)
      expect(CheckInsService.checkInsControllerGetCheckIns).not.toHaveBeenCalled()
    })

    it('should skip users with no session or access token', async () => {
      vi.mocked(getAllUserIds).mockReturnValue(['user-no-session'])
      vi.mocked(getSession).mockReturnValue(undefined)
      await tickSchedulerOnce(now)
      expect(CheckInsService.checkInsControllerGetCheckIns).not.toHaveBeenCalled()
    })

    it('should send a message for a check-in matching the current hour', async () => {
      vi.mocked(CheckInsService.checkInsControllerGetCheckIns).mockResolvedValue({
        items: [
          {
            id: 'c1',
            start: checkInTime.toISOString(),
            metadata: { message: 'Time for your check-in!', chatId: '001' },
          },
        ],
      } as any)

      await tickSchedulerOnce(now)

      expect(mockBot.sendMessage).toHaveBeenCalledWith(1, 'Time for your check-in!')
    })

    it('should skip check-ins that are in a different hour', async () => {
      const differentHour = new Date('2023-05-15T15:00:00Z')
      vi.mocked(CheckInsService.checkInsControllerGetCheckIns).mockResolvedValue({
        items: [{ id: 'c1', start: differentHour.toISOString(), metadata: { message: '...', chatId: '0001' } }],
      } as any)
      await tickSchedulerOnce(now)
      expect(mockBot.sendMessage).not.toHaveBeenCalled()
    })

    it('should skip check-ins with invalid start dates or no message', async () => {
      vi.mocked(CheckInsService.checkInsControllerGetCheckIns).mockResolvedValue({
        items: [
          { id: 'ci-invalid-date', start: 'not a date', metadata: { message: '...', chatId: '0001' } },
          { id: 'ci-no-message', start: checkInTime.toISOString(), metadata: { chatId: '0002' } },
          { id: 'ci-no-chatId', start: checkInTime.toISOString(), metadata: { message: '...' } },
        ],
      } as any)
      await tickSchedulerOnce(now)
      expect(mockBot.sendMessage).not.toHaveBeenCalled()
    })

    it('should not send the same message twice in the same hour', async () => {
      const checkIn = {
        id: 'c1',
        start: checkInTime.toISOString(),
        metadata: { message: 'hello', chatId: '001' },
      }
      vi.mocked(CheckInsService.checkInsControllerGetCheckIns).mockResolvedValue({
        items: [checkIn],
      } as any)
      await tickSchedulerOnce(now)
      await tickSchedulerOnce(now)
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1)
    })

    it('should send the same message again in a new hour', async () => {
      const checkIn = {
        id: 'c1',
        start: checkInTime.toISOString(),
        metadata: { message: 'hello', chatId: '001' },
      }
      vi.mocked(CheckInsService.checkInsControllerGetCheckIns).mockResolvedValue({
        items: [checkIn],
      } as any)

      await tickSchedulerOnce(now) // 14:30, sends
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1)

      const nextHour = new Date('2023-05-15T15:30:00Z')
      await tickSchedulerOnce(nextHour) // 15:30, should not send (wrong hour)
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1)

      const nextDaySameHour = new Date('2023-05-16T14:00:00Z')
      await tickSchedulerOnce(nextDaySameHour) // Next day at 14:00, should send again
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(2)
    })

    it('should handle pagination correctly', async () => {
      vi.mocked(CheckInsService.checkInsControllerGetCheckIns)
        .mockResolvedValueOnce({
          items: [{ id: 'c1', start: checkInTime.toISOString(), metadata: { message: 'msg1', chatId: '0001' } }],
          cursor: 'next',
        } as any)
        .mockResolvedValueOnce({
          items: [{ id: 'c2', start: checkInTime.toISOString(), metadata: { message: 'msg2', chatId: '0002' } }],
        } as any)

      await tickSchedulerOnce(now)

      expect(CheckInsService.checkInsControllerGetCheckIns).toHaveBeenCalledTimes(2)
      expect(CheckInsService.checkInsControllerGetCheckIns).toHaveBeenCalledWith({
        limit: 100,
        cursor: undefined,
      })
      expect(CheckInsService.checkInsControllerGetCheckIns).toHaveBeenCalledWith({
        limit: 100,
        cursor: 'next',
      })
      expect(mockBot.sendMessage).toHaveBeenCalledWith(1, 'msg1')
      expect(mockBot.sendMessage).toHaveBeenCalledWith(1, 'msg2')
    })

    it('should stop paging if backend call fails', async () => {
      vi.mocked(CheckInsService.checkInsControllerGetCheckIns).mockRejectedValue(
        new Error('API Down'),
      )
      await tickSchedulerOnce(now)
      expect(CheckInsService.checkInsControllerGetCheckIns).toHaveBeenCalledTimes(1)
      expect(mockBot.sendMessage).not.toHaveBeenCalled()
    })

    it('should continue if sending a message fails', async () => {
      const checkIns = [
        { id: 'c1', start: checkInTime.toISOString(), metadata: { message: 'msg1', chatId: '0001' } },
        { id: 'c2', start: checkInTime.toISOString(), metadata: { message: 'msg2', chatId: '0002' } },
      ]
      vi.mocked(CheckInsService.checkInsControllerGetCheckIns).mockResolvedValue({
        items: checkIns,
      } as any)
      vi.mocked(mockBot.sendMessage).mockRejectedValueOnce(new Error('Chat not found'))

      await tickSchedulerOnce(now)

      expect(mockBot.sendMessage).toHaveBeenCalledTimes(2)
      expect(mockBot.sendMessage).toHaveBeenCalledWith(1, 'msg1')
      expect(mockBot.sendMessage).toHaveBeenCalledWith(1, 'msg2')
    })

    it('should continue with other users if one fails', async () => {
      vi.mocked(getAllUserIds).mockReturnValue(['c1', 'c2'])

      vi.mocked(getSession).mockImplementation((userId) => {
        if (userId === 'c1') return { userId: 'c1', accessToken: 'token1' }
        if (userId === 'c2') return { userId: 'c2', accessToken: 'token2' }
        return undefined
      })
      let userAccessToken: string | undefined = undefined
      vi.mocked(configureBackendClient).mockImplementation((tokens) => {
        userAccessToken = tokens?.accessToken
      })
      const checkInsApi = vi.mocked(CheckInsService.checkInsControllerGetCheckIns)
      checkInsApi.mockImplementation((_) => {
        const session = getSession(userAccessToken === 'token1' ? 'c1' : 'c2')
        if (session?.userId === 'c1') throw new Error('API Down')
        return {
          items: [
            { id: 'ci-ok', start: now.toISOString(), metadata: { message: 'user2 message', chatId: '0002' } },
          ],
        } as any
      })

      await tickSchedulerOnce(now)

      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1)
      expect(mockBot.sendMessage).toHaveBeenCalledWith(2, 'user2 message')
    })
  })
})
