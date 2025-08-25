import React from 'react';

export default function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Electron + React + TypeScript</h1>
      <p>Welcome! This app was scaffolded with electron-vite.</p>
      <ul>
        <li>Node: {window.versions?.node?.()}</li>
        <li>Chrome: {window.versions?.chrome?.()}</li>
        <li>Electron: {window.versions?.electron?.()}</li>
      </ul>
    </div>
  );
}

declare global {
  interface Window {
    versions?: {
      node?: () => string;
      chrome?: () => string;
      electron?: () => string;
    };
  }
}
