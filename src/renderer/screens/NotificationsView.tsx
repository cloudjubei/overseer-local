import React, { useState } from 'react';
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar';

const SECTIONS = [
  { id: 'general', label: 'General', icon: <span aria-hidden>🔔</span>, accent: 'brand' },
  { id: 'messages', label: 'Messages', icon: <span aria-hidden>💬</span>, accent: 'teal' },
];

export default function NotificationsView() {
  const [activeSection, setActiveSection] = useState('general');

  return (
    <div className="flex min-h-0 w-full">
      <CollapsibleSidebar
        items={SECTIONS}
        activeId={activeSection}
        onSelect={setActiveSection}
        storageKey="notifications-panel-collapsed"
        headerTitle="Notifications"
        headerSubtitle="Alerts & Messages"
      />
      <main className="flex-1 min-w-0 min-h-0 overflow-auto p-4">
        {activeSection === 'general' && (
          <div>
            <h2 className="text-xl font-semibold mb-3">General Notifications</h2>
            {/* TODO: Implement general notifications list */}
            <p>Placeholder for general notifications.</p>
          </div>
        )}
        {activeSection === 'messages' && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Messages</h2>
            {/* TODO: Implement messages list */}
            <p>Placeholder for message notifications.</p>
          </div>
        )}
      </main>
    </div>
  );
}
