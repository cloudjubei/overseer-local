const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron')
const path = require('path')
const isDev = !app.isPackaged

// DB IPC setup
const { setupDbIpc, bindDbIngestionBroadcast } = require('./db/ipc')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const url = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../renderer/index.html')}`

  mainWindow.loadURL(url)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', () => {
  setupDbIpc()
  bindDbIngestionBroadcast(() => BrowserWindow.getAllWindows().map(w => w.webContents))
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
