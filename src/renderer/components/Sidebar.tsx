import React from 'react';
import { View } from '../types';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  return (
    <nav className="sidebar">
      <ul>
        <li>
          <button 
            onClick={() => setCurrentView('Home')}
            className={currentView === 'Home' ? 'active' : ''}
          >
            Home
          </button>
        </li>
        <li>
          <button 
            onClick={() => setCurrentView('Docs')}
            className={currentView === 'Docs' ? 'active' : ''}
          >
            Docs
          </button>
        </li>
        <li>
          <button 
            onClick={() => setCurrentView('Settings')}
            className={currentView === 'Settings' ? 'active' : ''}
          >
            Settings
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Sidebar;
