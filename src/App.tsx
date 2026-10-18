import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { PhoneShell } from './components/layout/PhoneShell';
import { BottomNav } from './components/layout/BottomNav';
import { useWakeLock } from './lib/wakeLock';

// 11 Screens
import { MapScreen } from './screens/MapScreen';
import { SearchScreen } from './screens/SearchScreen';
import { RoutePlanningScreen } from './screens/RoutePlanningScreen';
import { ActiveNavigationScreen } from './screens/ActiveNavigationScreen';
import { RoadAlertsScreen } from './screens/RoadAlertsScreen';
import { OfflineMapsScreen } from './screens/OfflineMapsScreen';
import { SavedPlacesScreen } from './screens/SavedPlacesScreen';
import { MapLayersScreen } from './screens/MapLayersScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TripToolsScreen } from './screens/TripToolsScreen';
import { AboutScreen } from './screens/AboutScreen';

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
          {renderScreen()}
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
