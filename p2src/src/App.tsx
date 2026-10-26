/**
 * StreamPlay — Premium International OTT (Cinema · Live TV · EPG)
 */

import React, { useState, useEffect } from 'react';
import type { Channel, Movie } from './types/index.js';
import { api } from './services/api.js';
import { ToastProvider } from './context/ToastContext.js';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { WatchlistProvider, useWatchlist } from './context/WatchlistContext.js';

import { Navbar } from './components/common/Navbar.js';
import { MobileBottomNav } from './components/common/MobileBottomNav.js';
import { Footer } from './components/common/Footer.js';
import { OfflineIndicator } from './components/common/OfflineIndicator.js';
import { SearchModal } from './components/common/SearchModal.js';
import { StreamPlayMark } from './components/common/StreamPlayLogo.js';
import { CinematicBackdrop } from './components/common/CinematicBackdrop.js';
import { MediaPlayerModal } from './components/player/MediaPlayerModal.js';

import { HomePage } from './pages/HomePage.js';
import { LiveTVPage } from './pages/LiveTVPage.js';
import { WatchPage } from './pages/WatchPage.js';
import { MoviesPage } from './pages/MoviesPage.js';
import { SeriesPage } from './pages/SeriesPage.js';
import { MyListPage } from './pages/MyListPage.js';
import { PricingPage } from './pages/PricingPage.js';
import { DevicesPage } from './pages/DevicesPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { CreatorHubPage } from './pages/creator/CreatorHubPage.js';
import { LegalPage } from './pages/LegalPage.js';
import { MovieDetailPage } from './pages/MovieDetailPage.js';


/** Branded route-gate loader */
const BrandLoader = ({ label }: { label: string }) => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4" role="status" aria-live="polite">
    <div className="relative">
      <StreamPlayMark className="w-14 h-14 animate-pulse" />
      <span className="absolute inset-0 rounded-2xl crimson-glow" aria-hidden="true" />
    </div>
    <p className="text-xs tracking-[0.3em] uppercase text-[#8993A3] font-semibold">{label}</p>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, status, isLoading } = useAuth();
  if (isLoading) return <BrandLoader label="Preparing your stream" />;
  if (!user) return <div>Please log in</div>;
  if (status !== 'active') return <div>Account pending or disabled.</div>;
  return <>{children}</>;
};

/**
 * Open-access viewing (playbeat.live model): browsing and watching require NO
 * account. Only surfaces that render PERSONAL data (Dashboard) or privileged
 * controls (Admin) remain behind authentication.
 */

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return <BrandLoader label="Opening Director Console" />;
  if (!user || !isAdmin) return <div>Access denied</div>;
  return <>{children}</>;
};

function MainApp() {

  const { playerState, openPlayer, closePlayer, continueWatching } = useWatchlist();
  const { user } = useAuth();

  const [currentTab, setCurrentTab] = useState<string>('home');
  const [cinemaView, setCinemaView] = useState<'movies' | 'series'>('movies');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [detailMovie, setDetailMovie] = useState<Movie | null>(null);

  // Load verified content. Re-runs when the authenticated identity changes so
  // members with an assigned Star IPTV line receive their OWN line's Live TV
  // catalog right after login (server-side token binding drives the source).
  useEffect(() => {
    async function loadContent() {
      try {
        const [movs, chans] = await Promise.all([
          api.getMovies(),
          api.getChannels(),
        ]);
        setMovies(movs);
        setChannels(chans);
      } catch (e) {
        console.error('Failed to load initial catalog:', e);
      }
    }
    loadContent();
  }, [user?.id]);

  const handlePlayMovie = (movie: Movie, mode: 'full' | 'trailer' = 'full') => {
    openPlayer({ movie, mode });
  };

  const handlePlayChannel = (channel: Channel) => {
    openPlayer({ channel, mode: 'full' });
  };

  // Central navigation: 'movies-series' opens the Cinema tab pre-set to Series
  const handleNavigate = (tab: string) => {
    if (tab === 'movies-series') {
      setCinemaView('series');
      setCurrentTab('movies');
      return;
    }
    setCurrentTab(tab);
  };

  const handleNextChannel = () => {
    if (!playerState.channel) return;
    const currentIdx = channels.findIndex((c) => c.id === playerState.channel!.id);
    const nextIdx = (currentIdx + 1) % channels.length;
    openPlayer({ channel: channels[nextIdx], mode: 'full' });
  };

  const handlePrevChannel = () => {
    if (!playerState.channel) return;
    const currentIdx = channels.findIndex((c) => c.id === playerState.channel!.id);
    const prevIdx = (currentIdx - 1 + channels.length) % channels.length;
    openPlayer({ channel: channels[prevIdx], mode: 'full' });
  };

  return (
    <div className="min-h-screen bg-[#04070B] text-[#F7F7F8] flex flex-col font-sans-custom relative">
      {/* Fixed cinematic environment (behind everything) */}
      <CinematicBackdrop />

      {/* Offline Status Badge */}
      <OfflineIndicator />

      {/* Floating Glass Navigation Header (hidden inside the Admin Console,
          which carries its own dedicated shell per the admin design spec) */}
      {currentTab !== 'admin' && (
        <Navbar
          currentTab={currentTab}
          onNavigate={handleNavigate}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      )}

      {/* Main Dynamic View Area */}
      <main className="flex-1 relative">
        {currentTab === 'home' && (
          <HomePage
            movies={movies}
            channels={channels}
            continueWatching={continueWatching}
            onPlayMovie={handlePlayMovie}
            onPlayChannel={handlePlayChannel}
            onOpenDetails={setDetailMovie}
            onNavigate={handleNavigate}
          />
        )}

        {/* Simple Player — sign in / connect line / start watching */}
        {currentTab === 'watch' && <WatchPage onNavigate={handleNavigate} />}

        {currentTab === 'live-tv' && (
          <LiveTVPage
            channels={channels}
            onPlayChannel={handlePlayChannel}
          />
        )}

        {currentTab === 'movies' && (
          <>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#111722] border border-white/10">
                {(['movies', 'series'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setCinemaView(v)}
                    className={`px-5 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      cinemaView === v ? 'bg-[#E5093A] text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            {cinemaView === 'movies' ? (
              <MoviesPage
                movies={movies}
                onPlayMovie={handlePlayMovie}
                onOpenDetails={setDetailMovie}
              />
            ) : (
              <SeriesPage onPlayMovie={handlePlayMovie} />
            )}
          </>
        )}

        {currentTab === 'free-cinema' && (
          <MoviesPage
            movies={movies}
            onPlayMovie={handlePlayMovie}
            onOpenDetails={setDetailMovie}
            publicDomainOnly={true}
          />
        )}

        {currentTab === 'pricing' && (
          <PricingPage onNavigate={setCurrentTab} />
        )}

        {/* Official app & device experience — public, no auth required */}
        {currentTab === 'devices' && (
          <DevicesPage onNavigate={handleNavigate} />
        )}

        {currentTab === 'my-list' && (
          <MyListPage
            movies={movies}
            channels={channels}
            onPlayMovie={handlePlayMovie}
            onPlayChannel={handlePlayChannel}
            onOpenDetails={setDetailMovie}
            onNavigate={setCurrentTab}
          />
        )}

        {currentTab === 'dashboard' && (
          <ProtectedRoute>
            <DashboardPage onNavigate={setCurrentTab} />
          </ProtectedRoute>
        )}

        {currentTab === 'admin' && (
          <AdminRoute>
            <AdminPage onNavigate={setCurrentTab} />
          </AdminRoute>
        )}

        {/* Creator Hub — open browse/watch; studio gates itself on creator identity */}
        {currentTab === 'creator-hub' && (
          <CreatorHubPage onNavigate={handleNavigate} />
        )}

        {/* Legal Sub-sections */}
        {(currentTab === 'copyright' ||
          currentTab === 'takedown' ||
          currentTab === 'terms' ||
          currentTab === 'privacy' ||
          currentTab === 'refund' ||
          currentTab === 'refund-policy' ||
          currentTab === 'disclaimer' ||
          currentTab === 'contact') && (
          <LegalPage
            section={
              currentTab === 'refund-policy'
                ? 'refund'
                : (currentTab as any)
            }
            onNavigate={setCurrentTab}
          />
        )}
      </main>

      {/* Luxury Cinematic Footer — the Admin Console carries its own dedicated
          shell (spec: console is a self-contained control surface) */}
      {currentTab !== 'admin' && (
        <div className="relative">
          <Footer onNavigate={setCurrentTab} />
        </div>
      )}

      {/* Mobile-First Bottom Navigation Bar */}
      {currentTab !== 'admin' && (
        <MobileBottomNav
          currentTab={currentTab}
          onNavigate={handleNavigate}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      )}

      {/* Immersive Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        movies={movies}
        channels={channels}
        onPlayMovie={handlePlayMovie}
        onPlayChannel={handlePlayChannel}
      />

      {/* Movie Details Modal */}
      {detailMovie && (
        <MovieDetailPage
          movie={detailMovie}
          allMovies={movies}
          onPlay={handlePlayMovie}
          onOpenDetails={setDetailMovie}
          onClose={() => setDetailMovie(null)}
        />
      )}

      {/* Master Streaming Video Player Modal */}
      {playerState.isOpen && (
        <MediaPlayerModal
          movie={playerState.movie}
          channel={playerState.channel}
          mode={playerState.mode}
          startPosition={playerState.startPosition}
          onClose={closePlayer}
          onNextChannel={handleNextChannel}
          onPrevChannel={handlePrevChannel}
          channels={channels}
          onSelectChannel={handlePlayChannel}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <WatchlistProvider>
          <MainApp />
        </WatchlistProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
