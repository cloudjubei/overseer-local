import React, { useState } from 'react';

function Settings() {
  const [currentTheme, setCurrentTheme] = useState('light');

  const themes = ['light', 'dark', 'blue'];

  const changeTheme = (theme: string) => {
    document.documentElement.className = `theme-${theme}`;
    setCurrentTheme(theme);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Select Theme</label>
        <select 
          value={currentTheme} 
          onChange={(e) => changeTheme(e.target.value)} 
          className="w-full p-2 border border-gray-300 rounded-md focus:border-primary focus:ring-primary"
        >
          {themes.map((theme) => (
            <option key={theme} value={theme}>
              {theme.charAt(0).toUpperCase() + theme.slice(1)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default Settings;
