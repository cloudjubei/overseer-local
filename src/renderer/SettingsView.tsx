import React, { useState, useEffect } from 'react';
import { Button } from './components/ui/button';

export default function SettingsView() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.className = `theme-${saved}`;
    return saved;
  });

  useEffect(() => {
    document.documentElement.className = `theme-${theme}`;
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="mb-4">
        <h2 className="text-xl mb-2">Theme</h2>
        <div className="flex space-x-4">
          <Button onClick={() => setTheme('light')} variant={theme === 'light' ? 'default' : 'outline'}>
            Light
          </Button>
          <Button onClick={() => setTheme('dark')} variant={theme === 'dark' ? 'default' : 'outline'}>
            Dark
          </Button>
          <Button onClick={() => setTheme('blue')} variant={theme === 'blue' ? 'default' : 'outline'}>
            Blue
          </Button>
        </div>
      </div>
      <Button onClick={() => location.hash = ''} variant="secondary">
        Back to Tasks
      </Button>
    </div>
  );
}
