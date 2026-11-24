# Desktop Show app fixture

The automated renderer-to-HTTP check is `npm run test -- ShowAppFakeBackend.test.tsx`. It uses the real desktop renderer, shared composer, and loopback fake CLI endpoint, with no Electron process. It executes the served production bridge on the fixture DOM and relays its messages with the mounted iframe identity in jsdom; it does not prove real iframe rendering or Electron behavior.

Start `npm run fake:backend` and leave it running. It binds to loopback, uses `PORT` (or an available port), runs the shared fake behind it, and accepts only throwaway `fake-` credentials. If `VITE_BEARER_TOKEN` is unset, use the printed throwaway credential. For real Electron, start the built app with an isolated Electron user-data directory, and connect through the normal login screen to the printed URL. Do not reuse a real account or profile. The existing served-app recipe can also drive the renderer with the same data, but that is not Electron proof.

In **TheFactory Tools → Chat**, select **App notes — first chat**. The first and second fixture chats start empty and use the fake CLI turn. **Show app** opens the cross-origin Release board. Once its heading and two buttons are visible, it is settled; there are no delayed fixture changes. The fixture serves the production App bridge. Shift-click **Release status: ready** to add a pick and keep picking, then click **Review owner: Morgan** without Shift to add the second pick and exit pick mode. The banner should disappear and the toolbar should say **Pick element**; use that button to re-enter if needed. Select **Close app** to see both draft notes. Edit the status comment to `Check this status` and remove the owner note. Switch to **App notes — second chat** (no notes), then return to the first (one edited note). Reopen and close the App to check that this does not discard the draft. Send with no text or files.

For the outbound assertion, GET `/fixture/last-app-note-turn` from the fake using the same throwaway bearer credential. It reports only a redacted projection of the latest accepted fixture request to `/api/v1/completions/send-chat-with-cli` (not the stored transcript); before sending it is `null`. Expect:

```json
{
  "context": {
    "type": "PROJECT_TOPIC",
    "projectId": "thefactory-tools",
    "topicId": "app-note-first"
  },
  "noteOnly": true,
  "appNotes": [
    {
      "projectId": "thefactory-tools",
      "comment": "Check this status",
      "targets": [{ "kind": "element", "selector": "html:nth-of-type(1) > body:nth-of-type(1) > main:nth-of-type(1) > article:nth-of-type(1) > button:nth-of-type(1)" }]
    }
  ]
}
```

Restart the fake and use a clean profile to reset the transcript and drafts for each comparison. To use the same fixtures on the base, launch this fake independently and connect the base Electron package to it through its login screen.
