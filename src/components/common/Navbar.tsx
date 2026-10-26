import React, { useState, useEffect, useRef } from 'react';
import { Search, Shield, LogOut, User as UserIcon, Bell, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { PWAInstallButton } from './PWAInstallButton.js';
import { StreamPlayLogo } from './StreamPlayLogo.js';

interface NavbarProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  onOpenSearch: () => void;
}

interface Notice {
  id: string;
  title: string;
  detail: string;
}

const PILOT_NOTICES: Notice[] = [
  {
    id: 'pilot',
    title: 'Private pilot active',
    detail: 'StreamPlay is in closed beta. Access is limited to approved members.',
  },
  {
    id: 'install',
    title: 'Install StreamPlay',
    detail: 'Add the app to your home screen for a full-screen experience.',
  },
  {
    id: 'vault',
    title: 'Vault security',
    detail: 'Provider credentials stay server-side — never exposed to members.',
  },
];

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onNavigate, onOpenSearch }) => {
  const { user, isAdmin, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [seenNotices, setSeenNotices] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'watch', label: 'Watch' },
    { id: 'live-tv', label: 'Live TV' },
    { id: 'movies', label: 'Cinema' },
    { id: 'creator-hub', label: 'Creator Hub' },
    { id: 'my-list', label: 'My List' },
    { id: 'dashboard', label: 'My Account' },
    { id: 'devices', label: 'Devices' },
  ];

  const markNoticesSeen = () => {
    setNoticesOpen((open) => {
      const next = !open;
      if (next) setSeenNotices(true);
      return next;
    });
  };

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ease-out ${
        isScrolled
          ? 'bg-[#04070B]/80 backdrop-blur-xl border-b border-white/[0.07] py-2.5 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.8)]'
          : 'bg-gradient-to-b from-[#04070B]/85 via-[#04070B]/40 to-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Zone 1: StreamPlay brand lockup */}
        <button
          onClick={() => onNavigate('home')}
          className="group flex items-center text-left focus:outline-none transition-transform duration-200 active:scale-[0.98]"
          aria-label="StreamPlay — Home"
        >
          <StreamPlayLogo
            iconClassName="w-9 h-9"
            textClassName="text-lg md:text-xl font-extrabold tracking-tight text-white"
          />
          <span className="hidden lg:inline-block ml-3 text-[9px] font-mono tracking-[0.28em] uppercase text-[#8993A3] border border-white/10 rounded-full px-2 py-0.5">
            Private Access
          </span>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium" aria-label="Primary">
          {navLinks.map((link) => {
            const isActive = currentTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-1.5 transition-colors duration-200 whitespace-nowrap ${
                  isActive ? 'text-white font-semibold' : 'text-[#C6CBD4] hover:text-white'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#E5093A] to-[#C0157F] rounded-full shadow-[0_0_10px_rgba(229,9,58,0.7)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions (Search · Notifications · Install · Profile) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Instant Search trigger */}
          <button
            onClick={onOpenSearch}
            className="p-2.5 rounded-full text-[#C6CBD4] hover:text-white hover:bg-white/[0.07] transition-colors duration-200 focus:outline-none"
            aria-label="Search content"
            title="Search movies & live channels"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          {/* Pilot notifications */}
          <div className="relative">
            <button
              onClick={markNoticesSeen}
              className="relative p-2.5 rounded-full text-[#C6CBD4] hover:text-white hover:bg-white/[0.07] transition-colors duration-200 focus:outline-none"
              aria-label="Notifications"
              aria-expanded={noticesOpen}
              title="Pilot notices"
            >
              <Bell className="w-[18px] h-[18px]" />
              {!seenNotices && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#E5093A] shadow-[0_0_6px_#E5093A]" />
              )}
            </button>

            {noticesOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setNoticesOpen(false)} />
                <div className="absolute right-0 mt-3 w-80 rounded-2xl bg-[#111A27]/95 backdrop-blur-2xl border border-white/10 shadow-2xl z-40 py-2 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
                    <p className="text-xs font-semibold text-white tracking-wide">Pilot Notices</p>
                    <span className="text-[10px] text-[#8993A3]">Private beta</span>
                  </div>
                  <ul className="py-1">
                    {PILOT_NOTICES.map((n) => (
                      <li
                        key={n.id}
                        className="px-4 py-2.5 hover:bg-white/[0.04] transition-colors"
                      >
                        <p className="flex items-center gap-2 text-xs font-semibold text-white">
                          <Check className="w-3 h-3 text-[#E5093A] shrink-0" />
                          {n.title}
                        </p>
                        <p className="text-[11px] text-[#8993A3] mt-0.5 pl-5 leading-relaxed">
                          {n.detail}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>

          {/* In-app PWA install button */}
          <div className="hidden sm:block">
            <PWAInstallButton compact />
          </div>

          {/* User Profile / Admin Menu */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1.5 pr-2 rounded-full border border-white/10 hover:border-white/25 bg-white/[0.05] text-sm transition-all duration-200 focus:outline-none"
              aria-expanded={profileOpen}
              aria-label="User profile menu"
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-white/15"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#18202C] flex items-center justify-center text-xs font-bold text-white">
                  {user?.name ? user.name[0] : 'U'}
                </div>
              )}
              <span className="hidden lg:inline text-xs font-medium text-[#C6CBD4] max-w-[120px] truncate">
                {user?.name || 'Private Member'}
              </span>
            </button>

            {/* Profile Menu Dropdown */}
            {profileOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setProfileOpen(false)}
                />
                <div className="absolute right-0 mt-2.5 w-72 rounded-2xl bg-[#111A27]/95 backdrop-blur-2xl border border-white/10 shadow-2xl z-40 py-2 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.06]">
                    <p className="text-xs font-semibold text-white truncate">{user?.name || 'Private Guest'}</p>
                    <p className="text-[11px] text-[#8993A3] truncate">{user?.email || 'Member account'}</p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px]">
                      <span className="tracking-wider uppercase font-semibold text-[#E5093A]">
                        {isAdmin ? 'Director / Admin' : 'Approved Member'}
                      </span>
                      <span className="text-[#8993A3] font-mono">Pilot Access</span>
                    </div>
                  </div>

                  <div className="py-1 text-xs">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        onNavigate('dashboard');
                      }}
                      className="w-full text-left px-4 py-2.5 text-[#C6CBD4] hover:bg-white/[0.05] hover:text-white flex items-center gap-2.5 transition-colors"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-[#8993A3]" />
                      <span>Member Devices & Access</span>
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          onNavigate('admin');
                        }}
                        className="w-full text-left px-4 py-2.5 text-[#C6CBD4] hover:bg-white/[0.05] hover:text-white flex items-center gap-2.5 transition-colors"
                      >
                        <Shield className="w-3.5 h-3.5 text-[#E5093A]" />
                        <span>Director Console (Members & Star IPTV)</span>
                      </button>
                    )}
                  </div>

                  {/* SECURITY (pre-merge review): the pilot persona switcher was
                      removed. Persona controls relied on client-side admin state
                      plus hard-coded seed credentials; access now comes only from
                      real sign-in with server-provisioned passwords. */}

                  {user && (
                    <div className="pt-1 border-t border-white/[0.06]">
                      <button
                        onClick={() => {
                          logout();
                          setProfileOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
