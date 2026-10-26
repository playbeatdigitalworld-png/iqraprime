import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-[#111A27]/95 border border-amber-500/40 px-4 py-2 text-xs font-medium text-amber-200 shadow-2xl backdrop-blur-md animate-bounce">
      <WifiOff className="w-4 h-4 text-amber-400" />
      <span>Offline Mode — Playing cached media shell</span>
    </div>
  );
};
