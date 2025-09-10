import React, { useEffect } from 'react';
import { useAppSettings } from '../settings/AppSettingsContext';

interface LoadingScreenProps {
  onLoaded: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoaded }) => {
  const { isAppSettingsLoaded } = useAppSettings();

  useEffect(() => {
    if (isAppSettingsLoaded) {
      onLoaded();
    }
  }, [isAppSettingsLoaded, onLoaded]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-black/5 dark:bg-black/20" style={{ fontFamily: 'sans-serif' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-transparent rounded-full" />
        <div className="text-gray-700 dark:text-gray-200 text-sm">Loading your settings…</div>
      </div>
    </div>
  );
};

export default LoadingScreen;
