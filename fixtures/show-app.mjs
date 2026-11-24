export const fixtureProject = 'thefactory-tools'

export const fixtureChats = ['first', 'second'].map((topic) => ({
  context: { type: 'PROJECT_TOPIC', projectId: fixtureProject, topicId: `app-note-${topic}` },
  title: `App notes — ${topic} chat`,
  cliRunner: { tool: 'claude-code' },
  createdAt: '2026-10-26T12:00:00.000Z',
  updatedAt: '2026-10-26T12:00:00.000Z',
  messageCount: 0,
  messageTimes: [],
  needsYouTimes: [],
}))

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Plain Node JavaScript.
export const appNoteFixture = (viewToken) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Release board</title>
  <style>
    body { font: 16px system-ui; color: #203044; background: #f2f6fb; margin: 0; }
    main { max-width: 44rem; margin: 4rem auto; padding: 0 1.5rem; }
    article { background: white; border: 1px solid #ced9e6; border-radius: 12px; padding: 1rem; }
    button { font: inherit; color: inherit; background: #ecf4ff; border: 1px solid #7594b6;
      border-radius: 6px; text-align: left; padding: .75rem; margin: .25rem; }
  </style>
</head>
<body>
  <main>
    <h1>Release board</h1>
    <article>
      <h2>Release candidate</h2>
      <button id="release-status" type="button">Release status: ready</button>
      <button id="review-owner" type="button">Review owner: Morgan</button>
    </article>
  </main>
  <script src="./bridge.js?viewToken=${encodeURIComponent(viewToken)}"></script>
</body>
</html>`
