import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dotenv to prevent it from loading .env files and interfering with tests
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

const originalEnv = { ...process.env };

// This function dynamically imports the module to re-evaluate it with new env vars
const getFreshEnvModule = async () => {
  vi.resetModules();
  return await import('../../src/config/env');
};

describe('config/env', () => {
  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original process.env after each test
    process.env = originalEnv;
  });

  it('should load config correctly when all required env vars are set', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'my-telegram-token';
    process.env.BACKEND_SHARED_SECRET = 'my-backend-secret';
    process.env.BACKEND_BASE_URL = 'http://api.example.com';
    process.env.TZ = 'Europe/London';
    process.env.NODE_ENV = 'production';

    const { config, getEnv } = await getFreshEnvModule();

    expect(config.telegramBotToken).toBe('my-telegram-token');
    expect(config.backendSharedSecret).toBe('my-backend-secret');
    expect(config.backendBaseUrl).toBe('http://api.example.com');
    expect(config.timezone).toBe('Europe/London');
    expect(config.nodeEnv).toBe('production');
    expect(getEnv('nodeEnv')).toBe('production');
  });

  it('should throw an error if TELEGRAM_BOT_TOKEN is missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    process.env.BACKEND_SHARED_SECRET = 'my-backend-secret';

    await expect(getFreshEnvModule()).rejects.toThrow(
      'Missing required environment variable: TELEGRAM_BOT_TOKEN',
    );
  });

  it('should throw an error if BACKEND_SHARED_SECRET is missing', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'my-telegram-token';
    delete process.env.BACKEND_SHARED_SECRET;

    await expect(getFreshEnvModule()).rejects.toThrow(
      'Missing required environment variable: BACKEND_SHARED_SECRET',
    );
  });

  it('should use default values for optional env vars', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'my-telegram-token';
    process.env.BACKEND_SHARED_SECRET = 'my-backend-secret';
    delete process.env.BACKEND_BASE_URL;
    delete process.env.TZ;
    delete process.env.NODE_ENV;

    const { config } = await getFreshEnvModule();

    expect(config.backendBaseUrl).toBe('http://localhost:3000');
    expect(config.timezone).toBe('UTC');
    expect(config.nodeEnv).toBe('development');
  });

  it('should throw an error for empty required env vars', async () => {
    process.env.TELEGRAM_BOT_TOKEN = '  '; // whitespace only
    process.env.BACKEND_SHARED_SECRET = 'my-backend-secret';

    await expect(getFreshEnvModule()).rejects.toThrow(
      'Missing required environment variable: TELEGRAM_BOT_TOKEN',
    );
  });
});
