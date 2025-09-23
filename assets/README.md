Assets

- sounds.ts: Provides synthesized sound effects for chat send/receive using the WebAudio API to avoid bundling binary files. This keeps the app lightweight and works offline.

Replacing with audio files (optional)

If you prefer to use real audio assets:

1) Add files under assets/audio/, e.g.:
   - assets/audio/send.mp3
   - assets/audio/receive.mp3

2) Import and use them from the UI, for example:

   import sendUrl from '../../assets/audio/send.mp3'
   import receiveUrl from '../../assets/audio/receive.mp3'
   const sendAudio = new Audio(sendUrl)
   sendAudio.play()

3) Remove or replace the calls to playSendSound/playReceiveSound in the UI.

Note: Some browsers (and Electron) require a user gesture before audio playback is allowed. The tryResumeAudioContext helper in sounds.ts is used to resume audio after a user action.
