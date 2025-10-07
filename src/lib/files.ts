import TelegramBot from 'node-telegram-bot-api'

// Helper to download a Telegram file as Buffer
export async function downloadTelegramAudioFile(
  bot: TelegramBot,
  fileId: string,
): Promise<{ blob: Blob; filename: string; mimeType?: string }> {
  // getFile gives us file_path, but getFileLink constructs a full URL including token
  const fileUrl = await bot.getFileLink(fileId as any)
  // Node 18+ provides global fetch
  const res = await fetch(fileUrl)
  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.status} ${res.statusText}`)
  }

  // await res.
  const blob = await res.blob()

  // Try to derive filename from URL
  const urlObj = new URL(fileUrl)
  const pathname = urlObj.pathname
  const base = pathname.substring(pathname.lastIndexOf('/') + 1) || 'voice.ogg'
  const contentType = res.headers.get('content-type') || undefined

  return { blob, filename: base, mimeType: contentType || 'audio/ogg' }
}
