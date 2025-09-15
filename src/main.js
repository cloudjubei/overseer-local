import { app, BrowserWindow, nativeImage } from 'electron'
import path from 'node:path'
import started from 'electron-squirrel-startup'
import { registerScreenshotService } from './capture/screenshotService'
import { initManagers, stopManagers } from './managers'

if (started) {
  app.quit()
}
let mainWindow

// Use Electron's app.isPackaged to determine dev vs prod
const IS_DEV = !app.isPackaged

const resolveDevIcon = () => {
  // In dev (electron-forge start + vite), __dirname points to .vite/build, so use process.cwd()
  const iconPath = path.join(process.cwd(), 'icon.png')
  const image = nativeImage.createFromPath(iconPath)
  return image
}

const getAppIcon = () => {
  return resolveDevIcon()
}

const createWindow = () => {
  const iconImage = getAppIcon()

  mainWindow = new BrowserWindow({
    width: IS_DEV ? 1600 : 1200,
    height: 800,
    icon: iconImage, // used on Windows/Linux; ignored on macOS (dock icon set below)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  mainWindow.webContents.openDevTools()
}

app.whenReady().then(async () => {
  // Set dock icon on macOS explicitly
  if (process.platform === 'darwin') {
    const iconImage = getAppIcon()
    if (!iconImage.isEmpty()) {
      app.dock.setIcon(iconImage)
    }
  }

  createWindow()

  registerScreenshotService(() => mainWindow)

  const projectRoot = app.getAppPath()

  await initManagers(projectRoot, mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
  stopManagers()
})
