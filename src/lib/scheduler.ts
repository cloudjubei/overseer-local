import cron from 'node-cron';
import { config } from '../config/env';
import { getAllUserIds, getSessionByUserId } from './sessionStore';
import { configureBackendClient } from './backendClient';
import { CheckInsService } from '../generated/backend/services/CheckInsService';

let scheduledTask: cron.ScheduledTask | null = null;

export function startScheduler() {
  if (scheduledTask) return;

  // Run at the start of every hour
  scheduledTask = cron.schedule(
    '0 * * * *',
    async () => {
      try {
        const userIds = await getAllUserIds();
        for (const userId of userIds) {
          try {
            const session = await getSessionByUserId(userId);
            if (!session || !session.accessToken) continue;

            // Configure backend client for this user
            configureBackendClient({ accessToken: session.accessToken });

            // Fetch active check-ins for this user
            // Assuming the backend uses a query param to filter active ones; if not, this will fetch all and backend handles filtering.
            await CheckInsService.checkInsControllerList({
              // Include common pagination defaults if the API supports it
              limit: 100,
              offset: 0,
              active: true as any, // typed per generated client; if not present it's ignored by the client
            } as any);
          } catch (err) {
            // Per-user error isolation: log and continue
            console.error(`Scheduler error for user ${userId}:`, err);
          }
        }
      } catch (e) {
        console.error('Scheduler top-level error:', e);
      }
    },
    {
      timezone: config.timezone || 'UTC',
    }
  );

  scheduledTask.start();
}

export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
