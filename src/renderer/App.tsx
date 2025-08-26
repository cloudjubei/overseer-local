import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import TasksView from './components/TasksView';
import Docs from './components/Docs';
import './App.css';
import { View } from './types';

function App() {
  const [currentView, setCurrentView] = useState<View>('Home');

  const renderView = () => {
    switch (currentView) {
      case 'Home':
        return <TasksView />;
      case 'Docs':
        return <Docs />;
      default:
        return <TasksView />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <main className="main-content">
        {renderView()}
      </main>
    </div>
  );
}

export default App;
