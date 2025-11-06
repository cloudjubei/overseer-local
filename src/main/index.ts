import { app, shell, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initManagers } from './managers'

const getAppIcon = () => {
  // In dev (electron-forge start + vite), __dirname points to .vite/build, so use process.cwd()
  const iconPath = join(process.cwd(), 'resources/icon.png')
  const image = nativeImage.createFromPath(iconPath)
  return image
}

async function createWindow(): Promise<void> {
  const mainWindow = new BrowserWindow({
    width: is.dev ? 1600 : 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon: getAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const projectRoot = app.getAppPath()
  await initManagers(projectRoot, mainWindow)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  if (process.platform === 'darwin') {
    const iconImage = getAppIcon()
    if (!iconImage.isEmpty()) {
      app.dock?.setIcon(iconImage)
    }
  }

  await createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
