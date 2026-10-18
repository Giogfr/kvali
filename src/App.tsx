import React, { useEffect, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { PhoneShell } from './components/layout/PhoneShell';
import { BottomNav } from './components/layout/BottomNav';
import { useWakeLock } from './lib/wakeLock';

// Screens are loaded on demand so the map engine stays out of the first paint.
const MapScreen = lazy(() => import('./screens/MapScreen').then((m) => ({ default: m.MapScreen })));
const SearchScreen = lazy(() => import('./screens/SearchScreen').then((m) => ({ default: m.SearchScreen })));
const RoutePlanningScreen = lazy(() => import('./screens/RoutePlanningScreen').then((m) => ({ default: m.RoutePlanningScreen })));
const ActiveNavigationScreen = lazy(() => import('./screens/ActiveNavigationScreen').then((m) => ({ default: m.ActiveNavigationScreen })));
const RoadAlertsScreen = lazy(() => import('./screens/RoadAlertsScreen').then((m) => ({ default: m.RoadAlertsScreen })));
const OfflineMapsScreen = lazy(() => import('./screens/OfflineMapsScreen').then((m) => ({ default: m.OfflineMapsScreen })));
const SavedPlacesScreen = lazy(() => import('./screens/SavedPlacesScreen').then((m) => ({ default: m.SavedPlacesScreen })));
const MapLayersScreen = lazy(() => import('./screens/MapLayersScreen').then((m) => ({ default: m.MapLayersScreen })));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })));
const TripToolsScreen = lazy(() => import('./screens/TripToolsScreen').then((m) => ({ default: m.TripToolsScreen })));
const AboutScreen = lazy(() => import('./screens/AboutScreen').then((m) => ({ default: m.AboutScreen })));

const ScreenFallback: React.FC = () => (
  <div className="w-full h-full flex items-center justify-center bg-[#F7F7F5] dark:bg-[#121212] animate-fade-in">
    <div className="w-9 h-9 rounded-full border-2 border-[#2F6FEB]/30 border-t-[#2F6FEB] animate-spin" />
  </div>
);

const MainScreenRouter: React.FC = () => {
  const { currentScreen, goBack, canGoBack, activeNav, isRecordingLiveTrack } = useApp();

  // Keep the screen on while driving or recording a track.
  useWakeLock(activeNav.isActive || isRecordingLiveTrack);

  // Browser back button support
  useEffect(() => {
    const handlePopState = () => {
      if (canGoBack) {
        goBack();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [canGoBack, goBack]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'map':
        return <MapScreen />;
      case 'search':
        return <SearchScreen />;
      case 'route-planning':
        return <RoutePlanningScreen />;
      case 'active-navigation':
        return <ActiveNavigationScreen />;
      case 'road-alerts':
        return <RoadAlertsScreen />;
      case 'offline-maps':
        return <OfflineMapsScreen />;
      case 'saved-places':
        return <SavedPlacesScreen />;
      case 'map-layers':
        return <MapLayersScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'trip-tools':
        return <TripToolsScreen />;
      case 'about':
        return <AboutScreen />;
      default:
        return <MapScreen />;
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <div key={currentScreen} className="flex-1 min-h-0 flex flex-col animate-screen-in">
          <Suspense fallback={<ScreenFallback />}>{renderScreen()}</Suspense>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <PhoneShell>
          <MainScreenRouter />
        </PhoneShell>
      </ToastProvider>
    </AppProvider>
  );
}
