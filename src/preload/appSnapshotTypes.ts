export type SnapshotSize = { width: number; height: number }

export type AppSnapshot = {
  png: Uint8Array<ArrayBuffer>
  image: SnapshotSize
  appViewport: SnapshotSize
}

export type AppSnapshotService = {
  capture: (requestId: string) => Promise<AppSnapshot>
  cancel: (requestId: string) => Promise<void>
}
