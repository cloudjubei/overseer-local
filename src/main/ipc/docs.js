import { ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';

export function registerDocsIpcHandlers(projectRoot) {
  ipcMain.handle('docs:getContent', async (event, filePath) => {
    try {
      const absoluteFilePath = path.join(projectRoot, filePath);

      if (!absoluteFilePath.startsWith(projectRoot)) {
        console.error('Attempted to access file outside of project root:', absoluteFilePath);
        throw new Error('Access denied');
      }
      
      const content = await fs.readFile(absoluteFilePath, 'utf-8');
      return content;
    } catch (error) {
      console.error(`Failed to read file: ${filePath}`, error);
      throw error;
    }
  });
}
