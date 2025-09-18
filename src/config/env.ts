// Centralized environment configuration loader
// Uses dotenv to load variables from .env files
// Ensure to install runtime dependency: npm i dotenv

import dotenv from 'dotenv'

// Load .env.local first (optional overrides), then .env
// This allows developers to have local overrides without changing the shared .env.example
dotenv.config({ path: '.env.local', override: true })
dotenv.config()

function required(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable: ${name}.\n` +
        `Create a .env file based on .env.example and set ${name}.`,
    )
  }
  return value
}

function optional(name: string, fallback: string): string {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value : fallback
}

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production' | string
  timezone: string
  telegramBotToken: string // required
  backendSharedSecret: string // required
  backendBaseUrl: string // optional with sensible default
}

export const config: AppConfig = {
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) || 'development',
  timezone: optional('TZ', 'UTC'),
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  backendSharedSecret: required('BACKEND_SHARED_SECRET'),
  // You may adjust this default once backend base URL is finalized
  backendBaseUrl: optional('BACKEND_BASE_URL', 'http://localhost:3000'),
}

// Convenience accessor with helpful error for missing keys
export function getEnv(key: keyof AppConfig): string {
  return config[key]
}

// Example: import { config } from './config/env';
//          const token = config.telegramBotToken;
