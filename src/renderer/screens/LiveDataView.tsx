import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { getPricingState, refreshPricing, PricingState } from '@/services/pricingService';
import { Icons } from '@/components/ui/Icons';

const LiveDataView = () => {
  const [pricingState, setPricingState] = useState<PricingState | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchInitialState = useCallback(async () => {
    const state = await getPricingState();
    setPricingState(state);
  }, []);

  useEffect(() => {
    fetchInitialState();
  }, [fetchInitialState]);

  const handleUpdate = async (serviceName: string) => {
    console.log(`Triggering update for ${serviceName}...`);
    setIsUpdating(true);
    try {
      const newState = await refreshPricing();
      setPricingState(newState);
    } catch (error) {
      console.error('Failed to update pricing:', error);
      // Optionally, show an error to the user
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Live Data</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Agent Prices</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {pricingState ? new Date(pricingState.updatedAt).toLocaleString() : 'Loading...'}
            </p>
          </div>
          <Button onClick={() => handleUpdate('Agent Prices')} disabled={isUpdating}>
            {isUpdating ? <Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isUpdating ? 'Updating...' : 'Update'}
          </Button>
        </div>
      </div>
      
    </div>
  );
};

export default LiveDataView;
