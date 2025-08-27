import { BrowserWindow, ipcMain } from 'electron';

/**
 * Register the screenshot capture IPC service.
 *
 * Methods:
 * - screenshot:capture(options)
 *   options: {
 *     windowId?: number;           // target BrowserWindow id, defaults to provided getWindow() or focused window
 *     rect?: { x: number, y: number, width: number, height: number }; // capture region in DIP coordinates
 *     format?: 'png' | 'jpeg';     // output format, default 'png'
 *     quality?: number;            // JPEG quality 0-100 (only applies to jpeg)
 *   }
 *   returns: { ok: true, dataUrl, width, height, format, windowId } | { ok: false, error }
 */
export function registerScreenshotService(getWindow) {
  async function getTargetWindow(windowId) {
    if (typeof windowId === 'number') {
      const w = BrowserWindow.fromId(windowId);
      if (w) return w;
    }
    if (typeof getWindow === 'function') {
      const w = getWindow();
      if (w) return w;
    }
    return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  }

  ipcMain.handle('screenshot:capture', async (_event, options = {}) => {
    try {
      const { windowId, rect, format: fmt, quality: q } = options || {};
      const target = await getTargetWindow(windowId);
      if (!target) return { ok: false, error: 'No target window to capture' };

      const image = await target.webContents.capturePage(rect && typeof rect === 'object' ? rect : undefined);
      const format = (fmt || 'png').toString().toLowerCase();
      const quality = typeof q === 'number' && !Number.isNaN(q) ? Math.max(0, Math.min(100, q)) : 80;

      let buffer;
      if (format === 'jpeg' || format === 'jpg') {
        buffer = image.toJPEG(quality);
      } else {
        buffer = image.toPNG();
      }
      const base64 = buffer.toString('base64');
      const dataUrl = `data:image/${format === 'jpg' ? 'jpeg' : format};base64,${base64}`;
      const { width, height } = image.getSize();

      return { ok: true, dataUrl, width, height, format: format === 'jpg' ? 'jpeg' : format, windowId: target.id };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  });
}
