import React from 'react';
import { Button } from '@/components/ui/Button';

const LiveDataView = () => {
  const handleUpdate = (serviceName: string) => {
    console.log(`Triggering update for ${serviceName}...`);
    // TODO: Implement IPC call to the main process
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Live Data</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Agent Prices</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: Never</p>
          </div>
          <Button onClick={() => handleUpdate('Agent Prices')}>Update</Button>
        </div>
      </div>
      
    </div>
  );
};

export default LiveDataView;
