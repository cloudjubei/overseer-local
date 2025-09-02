import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export default class AppStorage {
  constructor(subdir) {
    this.basePath = path.join(app.getPath('userData'), subdir);
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  getItem(key) {
    const filePath = path.join(this.basePath, `${key}.json`);
    try {
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error(`Failed to get ${key}:`, error);
      return null;
    }
  }

  setItem(key, value) {
    const filePath = path.join(this.basePath, `${key}.json`);
    try {
      fs.writeFileSync(filePath, value, 'utf8');
    } catch (error) {
      console.error(`Failed to set ${key}:`, error);
    }
  }

  removeItem(key) {
    const filePath = path.join(this.basePath, `${key}.json`);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
      console.error(`Failed to remove ${key}:`, error);
    }
  }
}
