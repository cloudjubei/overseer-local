import { app, shell, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
// import icon from '../../resources/icon.png?asset'
import { initManagers } from './managers'

let mainWindow

const getAppIcon = () => {
  // In dev (electron-forge start + vite), __dirname points to .vite/build, so use process.cwd()
  console.log('process.cwd: ', process.cwd())
  const iconPath = join(process.cwd(), 'resources/icon.png')
  const image = nativeImage.createFromPath(iconPath)
  return image
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
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

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.openDevTools()
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

  createWindow()

  const projectRoot = app.getAppPath()

  await initManagers(projectRoot, mainWindow)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
