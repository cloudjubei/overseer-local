const macSigningRequested = Boolean(process.env.CSC_LINK || process.env.CSC_NAME)

module.exports = {
  appId: 'com.thefactory.overseer.desktop',
  productName: 'Overseer',
  extraMetadata: {
    name: 'overseer',
    productName: 'Overseer',
    homepage: 'https://github.com/cloudjubei/overseer-local',
  },
  directories: {
    buildResources: 'build',
    output: 'dist',
  },
  files: ['out/**/*', 'package.json', 'resources/**'],
  asar: true,
  asarUnpack: ['resources/**'],
  win: {
    executableName: 'Overseer',
    icon: 'build/icon.ico',
    target: ['nsis'],
  },
  nsis: {
    artifactName: '${productName}-${version}-setup.${ext}',
    shortcutName: '${productName}',
    uninstallDisplayName: '${productName}',
    createDesktopShortcut: 'always',
  },
  mac: {
    ...(macSigningRequested ? {} : { identity: null }),
    type: 'distribution',
    icon: 'build/icon.icns',
    category: 'public.app-category.developer-tools',
    target: ['dmg', 'zip'],
    hardenedRuntime: true,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    extendInfo: {
      NSMicrophoneUsageDescription: 'Overseer uses the microphone for voice input in chat.',
      NSAppleEventsUsageDescription: 'Overseer uses System Events to start macOS Dictation.',
    },
  },
  dmg: {
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
  linux: {
    icon: 'build/icon.png',
    target: ['AppImage', 'snap', 'deb'],
    category: 'Development',
  },
  appImage: {
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
  deb: {
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
  // `npmRebuild: false` is safe because desktop has no native Node deps post-cutover
  // (no thefactory-db, no Postgres bindings, no sharp). Re-enable if a future
  // native dep is added.
  npmRebuild: false,
}
