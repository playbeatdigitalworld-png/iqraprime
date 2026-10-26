import React from 'react';
import { Home, Tv, Search, Play, User } from 'lucide-react';

interface MobileBottomNavProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  onOpenSearch: () => void;
}

/**
 * Native-feeling PWA bottom navigation: Home · Watch · Search · Live · Profile.
 * Safe-area aware, 48px+ touch targets, subtle active state.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentTab, onNavigate, onOpenSearch }) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home, action: 'navigate' as const },
    { id: 'watch', label: 'Watch', icon: Play, action: 'navigate' as const },
    { id: 'search', label: 'Search', icon: Search, action: 'search' as const },
    { id: 'live-tv', label: 'Live', icon: Tv, action: 'navigate' as const },
    { id: 'dashboard', label: 'Profile', icon: User, action: 'navigate' as const },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070B12]/92 backdrop-blur-2xl border-t border-white/[0.07] px-1 pb-safe"
      style={{ height: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-5 h-full items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          const isSearch = tab.action === 'search';
          return (
            <button
              key={tab.id}
              onClick={() => (isSearch ? onOpenSearch() : onNavigate(tab.id))}
              className="flex flex-col items-center justify-center min-h-[48px] w-full transition-colors duration-200 relative focus:outline-none"
              aria-label={tab.label}
              aria-current={isActive && !isSearch ? 'page' : undefined}
            >
              {/* Active pill halo */}
              <span
                className={`absolute top-1/2 -translate-y-[60%] w-12 h-8 rounded-full transition-all duration-300 ${
                  isActive ? 'bg-[#E5093A]/[0.14] scale-100' : 'scale-0'
                }`}
                aria-hidden="true"
              />
              <Icon
                className={`w-[21px] h-[21px] relative transition-all duration-200 ${
                  isActive ? 'text-[#FF2E55] scale-110 -translate-y-px' : 'text-[#8993A3]'
                }`}
                strokeWidth={isActive ? 2.4 : 2}
              />
              <span
                className={`relative text-[10px] font-medium tracking-tight mt-0.5 truncate transition-colors duration-200 ${
                  isActive ? 'text-white font-semibold' : 'text-[#8993A3]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
