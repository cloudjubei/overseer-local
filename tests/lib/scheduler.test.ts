import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import cron from 'node-cron';
import type TelegramBot from 'node-telegram-bot-api';

// Mock dependencies
vi.mock('node-cron');
vi.mock('../../src/lib/sessionStore');
vi.mock('../../src/lib/backendClient');
vi.mock('../../src/generated/backend');

import {
  initScheduler,
  shutdownScheduler,
  tickSchedulerOnce,
  currentHourStamp,
  sameHourOfDay,
  getMessageFromMetadata,
} from '../../src/lib/scheduler';
import { getAllUserIds, getSession } from '../../src/lib/sessionStore';
import { CheckInsService } from '../../src/generated/backend';

describe('lib/scheduler', () => {
  const mockBot = { sendMessage: vi.fn() } as unknown as TelegramBot;
  const mockTask = { start: vi.fn(), stop: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(cron.schedule).mockReturnValue(mockTask as any);
    // Manually inject the bot reference for tickSchedulerOnce
    initScheduler(mockBot);
  });

  afterEach(() => {
    shutdownScheduler();
  });

  describe('helper functions', () => {
    it('currentHourStamp should format correctly', () => {
      const d = new Date('2023-01-05T09:30:00.000Z');
      expect(currentHourStamp(d)).toMatch(/20230105\d{2}$/); // Handle timezone differences
    });

    it('sameHourOfDay should compare hours correctly', () => {
      const d1 = new Date();
      d1.setHours(10);
      const d2 = new Date();
      d2.setHours(10);
      const d3 = new Date();
      d3.setHours(11);
      expect(sameHourOfDay(d1, d2)).toBe(true);
      expect(sameHourOfDay(d1, d3)).toBe(false);
    });

    it('getMessageFromMetadata should extract message from various keys', () => {
      expect(getMessageFromMetadata({ message: 'a' })).toBe('a');
      expect(getMessageFromMetadata({ text: 'b' })).toBe('b');
      expect(getMessageFromMetadata({ content: 'c' })).toBe('c');
      expect(getMessageFromMetadata({ msg: 'd' })).toBe('d');
      expect(getMessageFromMetadata({ other: 'e' })).toBeUndefined();
      expect(getMessageFromMetadata({})).toBeUndefined();
    });
  });

  describe('tickSchedulerOnce', () => {
    it('should do nothing if no users are found', async () => {
      vi.mocked(getAllUserIds).mockReturnValue([]);
      await tickSchedulerOnce();
      expect(CheckInsService.checkInsControllerGetCheckIns).not.toHaveBeenCalled();
    });

    it('should send a message for a check-in matching the current hour', async () => {
      const now = new Date();
      now.setHours(14, 30, 0, 0); // 14:30
      const checkInTime = new Date(now);
      checkInTime.setMinutes(0); // 14:00

      vi.mocked(getAllUserIds).mockReturnValue(['user1']);
      vi.mocked(getSession).mockReturnValue({ userId: 'user1', accessToken: 'token1' });
      vi.mocked(CheckInsService.checkInsControllerGetCheckIns).mockResolvedValue({
        items: [{ id: 'ci1', start: checkInTime.toISOString(), metadata: { message: 'Time for your check-in!' } }],
      } as any);

      await tickSchedulerOnce(now);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(1, 'Time for your check-in!');
    });

    it('should not send a message for a check-in in a different hour', async () => {
        const now = new Date();
        now.setHours(14, 30, 0, 0); // 14:30
        const checkInTime = new Date(now);
        checkInTime.setHours(15, 0, 0, 0); // 15:00
  
        vi.mocked(getAllUserIds).mockReturnValue(['user1']);
        vi.mocked(getSession).mockReturnValue({ userId: 'user1', accessToken: 'token1' });
        vi.mocked(CheckInsService.checkInsControllerGetCheckIns).mockResolvedValue({
          items: [{ id: 'ci1', start: checkInTime.toISOString(), metadata: { message: '...' } }],
        } as any);
  
        await tickSchedulerOnce(now);
  
        expect(mockBot.sendMessage).not.toHaveBeenCalled();
      });

    it('should not send a message twice due to de-duplication', async () => {
      const now = new Date();
      now.setHours(10, 0, 0, 0);
      vi.mocked(getAllUserIds).mockReturnValue(['user1']);
      vi.mocked(getSession).mockReturnValue({ userId: 'user1', accessToken: 'token1' });
      vi.mocked(CheckInsService.checkInsControllerGetCheckIns).mockResolvedValue({
        items: [{ id: 'ci1', start: now.toISOString(), metadata: { message: 'hello' } }],
      } as any);

      // First tick, should send
      await tickSchedulerOnce(now);
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);

      // Second tick in same hour, should not send
      await tickSchedulerOnce(now);
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should handle pagination correctly', async () => {
        const now = new Date();
        now.setHours(9, 0, 0, 0);
        vi.mocked(getAllUserIds).mockReturnValue(['user1']);
        vi.mocked(getSession).mockReturnValue({ userId: 'user1', accessToken: 'token1' });
        
        // First page with a cursor
        vi.mocked(CheckInsService.checkInsControllerGetCheckIns)
          .mockResolvedValueOnce({ items: [{ id: 'ci1', start: now.toISOString(), metadata: { message: 'msg1' } }], cursor: 'next' } as any)
          .mockResolvedValueOnce({ items: [{ id: 'ci2', start: now.toISOString(), metadata: { message: 'msg2' } }] } as any);
    
        await tickSchedulerOnce(now);
    
        expect(CheckInsService.checkInsControllerGetCheckIns).toHaveBeenCalledTimes(2);
        expect(mockBot.sendMessage).toHaveBeenCalledWith(1, 'msg1');
        expect(mockBot.sendMessage).toHaveBeenCalledWith(1, 'msg2');
      });

    it('should continue processing users if one fails', async () => {
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      vi.mocked(getAllUserIds).mockReturnValue(['user1-fail', 'user2-ok']);
      
      // Session for user 1 (will fail)
      vi.mocked(getSession).calledWith('user1-fail').mockReturnValue({ userId: 'user1-fail', accessToken: 'token1' });
      vi.mocked(CheckInsService.checkInsControllerGetCheckIns).calledWith(expect.any(Object)).mockRejectedValueOnce(new Error('API Down'));

      // Session for user 2 (will succeed)
      vi.mocked(getSession).calledWith('user2-ok').mockReturnValue({ userId: 'user2-ok', accessToken: 'token2' });
      vi.mocked(CheckInsService.checkInsControllerGetCheckIns).calledWith(expect.any(Object)).mockResolvedValueOnce({ items: [{ id: 'ci-ok', start: now.toISOString(), metadata: { message: 'user2 message' } }] } as any);

      await tickSchedulerOnce(now);

      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(2, 'user2 message');
    });
  });
});
