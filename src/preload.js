const { contextBridge, ipcRenderer } = require('electron')

const DB_INGESTION_START = 'db:ingestion:start'
const DB_INGESTION_STATUS = 'db:ingestion:status'

contextBridge.exposeInMainWorld('db', {
  startIngestion: () => ipcRenderer.invoke(DB_INGESTION_START),
  onIngestionStatus: (cb) => {
    const listener = (_event, payload) => cb(payload)
    ipcRenderer.on(DB_INGESTION_STATUS, listener)
    return () => ipcRenderer.removeListener(DB_INGESTION_STATUS, listener)
  },
})
