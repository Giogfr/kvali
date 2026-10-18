import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AlertCategory,
  GeolocationStatus,
  Language,
  LayerVisibility,
  OfflineRegion,
  Place,
  PlaceCategory,
  RecordedTrack,
  RoadAlert,
  RouteAlternative,
  RoutePreferences,
  SavedPlace,
  ScreenId,
  TemporaryPin,
  ThemeMode,
  TravelMode,
  UnitSystem,
  UserLocation,
  VoiceMode,
} from '../types';
import { SEED_PLACES } from '../data/seedPlaces';
import { SEED_ALERTS } from '../data/seedAlerts';
import { SEED_REGIONS } from '../data/seedRegions';
import { SEED_TRACKS } from '../data/seedTracks';
import { TRANSLATIONS } from '../lib/translations';
import { fetchOsrmRoute, fetchOverpassPois, reverseGeocodeNominatim } from '../lib/services';
import { getCurrentLocation, watchLocation, LocationError, type LocationResult } from '../lib/location';
import { computeProgress } from '../lib/navigation';
import { generateRouteAlternatives } from '../lib/geo';

interface ActiveNavState {
  isActive: boolean;
  route: RouteAlternative | null;
  gpsActive: boolean;
  offRouteM: number;
  remainingDistanceKm: number;
  remainingDurationMinutes: number;
  currentSpeedKmh: number;
  speedLimitKmh: number;
  currentManeuver: {
    instruction: string;
    instructionKa: string;
    roadName: string;
    distanceMeters: number;
  };
  upcomingAlert: RoadAlert | null;
}

interface AppContextType {
  // Navigation & Screens
  currentScreen: ScreenId;
  navigateTo: (screen: ScreenId) => void;
  goBack: () => void;
  canGoBack: boolean;

  // Localization & Translation
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;

  // Theme & Units
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
  voiceMode: VoiceMode;
  setVoiceMode: (mode: VoiceMode) => void;

  // Travel Mode & Route Preferences
  travelMode: TravelMode;
  setTravelMode: (mode: TravelMode) => void;
  routePreferences: RoutePreferences;
  setRoutePreferences: React.Dispatch<React.SetStateAction<RoutePreferences>>;

  // Real Geolocation
  userLocation: UserLocation | null;
  geolocationStatus: GeolocationStatus;
  requestUserLocation: () => Promise<boolean>;
  effectiveCenter: { latitude: number; longitude: number };

  // Places, Map Pins & Search
  places: Place[];
  selectedPlace: Place | null;
  setSelectedPlace: (place: Place | null) => void;
  temporaryPin: TemporaryPin | null;
  setTemporaryPin: (pin: TemporaryPin | null) => void;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  handleMapTapCoords: (coords: { latitude: number; longitude: number }) => Promise<void>;

  // Route Planning State
  routeOrigin: { name: string; latitude: number; longitude: number } | null;
  setRouteOrigin: (origin: { name: string; latitude: number; longitude: number } | null) => void;
  routeDestination: Place | TemporaryPin | null;
  setRouteDestination: (dest: Place | TemporaryPin | null) => void;
  intermediateStops: (Place | TemporaryPin)[];
  addIntermediateStop: (stop: Place | TemporaryPin) => void;
  removeIntermediateStop: (index: number) => void;
  routeAlternatives: RouteAlternative[];
  selectedRouteAlternative: RouteAlternative | null;
  setSelectedRouteAlternative: (route: RouteAlternative | null) => void;
  isCalculatingRoute: boolean;
  routeError: string | null;
  calculateRoutes: () => Promise<void>;
  getShareableRouteUrl: () => string;

  // Active Navigation
  activeNav: ActiveNavState;
  startNavigation: (route: RouteAlternative) => void;
  endNavigation: () => void;

  // Road Alerts
  roadAlerts: RoadAlert[];
  enabledAlertCategories: Record<AlertCategory, boolean>;
  toggleAlertCategory: (cat: AlertCategory) => void;
  reportAlert: (input: {
    category: AlertCategory;
    latitude: number;
    longitude: number;
    description?: string;
    speedLimit?: number;
  }) => RoadAlert;
  removeAlert: (id: string) => void;
  alertDistanceMeters: number;
  setAlertDistanceMeters: (meters: number) => void;
  beepVolume: number;
  setBeepVolume: (vol: number) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  playTestBeep: () => void;

  // Layers & Offline Mode
  layers: LayerVisibility;
  toggleLayer: (layer: keyof LayerVisibility) => void;
  offlineRegions: OfflineRegion[];
  updateRegionStatus: (id: string, action: 'download' | 'pause' | 'resume' | 'cancel' | 'retry' | 'remove' | 'update') => void;
  patchRegion: (id: string, patch: Partial<OfflineRegion>) => void;
  airplaneOfflineMode: boolean;
  setAirplaneOfflineMode: (offline: boolean) => void;

  // Saved Places & Collections
  savedPlaces: SavedPlace[];
  collections: string[];
  savePlace: (place: { name: string; latitude: number; longitude: number; collection: string; note?: string; category?: Place['category'] }) => void;
  updateSavedPlace: (id: string, updates: Partial<SavedPlace>) => void;
  deleteSavedPlace: (id: string) => void;
  createCollection: (name: string) => void;
  importPlacesJson: (jsonData: string) => boolean;

  // Tracks & Trips
  recordedTracks: RecordedTrack[];
  deleteTrack: (id: string) => void;
  addSimulatedTrack: () => void;
  isRecordingLiveTrack: boolean;
  startLiveTrackRecording: () => void;
  stopAndSaveLiveTrack: (title?: string) => void;

  // Recenter Trigger
  recenterTrigger: number;
  triggerRecenter: () => void;

  // Prototype Reset
  resetPrototypeData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_ALERT_CATEGORIES: Record<AlertCategory, boolean> = {
  fixed_speed_camera: true,
  average_speed_zone: true,
  red_light_camera: true,
  combined_camera: true,
  enforcement_other: true,
  speed_limit_change: true,
  roadworks: true,
  accidents: true,
  road_closures: true,
  broken_down_vehicle: true,
  dangerous_conditions: true,
  lane_restrictions: true,
  community_reports: true,
  mobile_police: false,
};

const DEFAULT_LAYERS: LayerVisibility = {
  pointsOfInterest: true,
  speedCameras: true,
  speedLimits: true,
  communityReports: true,
  savedPlaces: true,
  recordedTracks: true,
  terrainNotice: false,
};

const INITIAL_SAVED_PLACES: SavedPlace[] = [
  {
    id: 'saved-bagrati',
    name: 'Bagrati Cathedral',
    collection: 'Favorites',
    latitude: 42.2772,
    longitude: 42.7042,
    category: 'attractions',
    note: 'Panoramic overlook of Kutaisi at sunset.',
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'saved-fountain',
    name: 'Colchis Fountain',
    collection: 'Favorites',
    latitude: 42.2679,
    longitude: 42.7001,
    category: 'attractions',
    note: 'Central meeting point.',
    createdAt: Date.now() - 86400000 * 5,
  },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation & Screens
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('map');
  const [navHistory, setNavHistory] = useState<ScreenId[]>(['map']);

  // Theme
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('kvali_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  // Language
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('kvali_lang');
      return saved === 'ka' ? 'ka' : 'en';
    } catch {
      return 'en';
    }
  });

  // Units
  const [units, setUnitsState] = useState<UnitSystem>(() => {
    try {
      const saved = localStorage.getItem('kvali_units');
      return saved === 'imperial' ? 'imperial' : 'metric';
    } catch {
      return 'metric';
    }
  });

  // Voice guidance
  const [voiceMode, setVoiceModeState] = useState<VoiceMode>(() => {
    try {
      const saved = localStorage.getItem('kvali_voice');
      return saved === 'spoken' || saved === 'muted' ? saved : 'chime';
    } catch {
      return 'chime';
    }
  });

  // Travel Mode & Route Preferences
  const [travelMode, setTravelModeState] = useState<TravelMode>(() => {
    try {
      const saved = localStorage.getItem('kvali_mode');
      return saved === 'walking' || saved === 'cycling' ? saved : 'car';
    } catch {
      return 'car';
    }
  });

  const [routePreferences, setRoutePreferences] = useState<RoutePreferences>(() => {
    try {
      const saved = localStorage.getItem('kvali_route_pref');
      return saved ? JSON.parse(saved) : { avoidTolls: false, avoidHighways: false, avoidUnpaved: true };
    } catch {
      return { avoidTolls: false, avoidHighways: false, avoidUnpaved: true };
    }
  });

  // Real Geolocation
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>('idle');
  const stopWatchRef = useRef<(() => void) | null>(null);

  // Live Track Recording
  const [isRecordingLiveTrack, setIsRecordingLiveTrack] = useState(false);
  const [liveTrackPoints, setLiveTrackPoints] = useState<[number, number][]>([]);
  const liveTrackStartTime = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const lastRerouteRef = useRef(0);
  const lastSpokenRef = useRef('');

  useEffect(() => {
    isRecordingRef.current = isRecordingLiveTrack;
  }, [isRecordingLiveTrack]);

  const applyLocation = useCallback((loc: LocationResult) => {
    setUserLocation({
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracyMeters: loc.accuracyMeters ?? undefined,
      speedKmh: loc.speedKmh,
      headingDegrees: loc.headingDegrees,
      timestamp: loc.timestamp,
    });
    if (isRecordingRef.current) {
      setLiveTrackPoints((prev) => [...prev, [loc.longitude, loc.latitude]]);
    }
  }, []);

  // Default Kutaisi Center: 42.2679, 42.6946
  const defaultCenter = { latitude: 42.2679, longitude: 42.6946 };
  const effectiveCenter = userLocation
    ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
    : defaultCenter;

  const [recenterTrigger, setRecenterTrigger] = useState<number>(0);

  // Places, Pins & Search
  const [seedPlaces] = useState<Place[]>(SEED_PLACES);
  const [nearbyPois, setNearbyPois] = useState<Place[]>([]);
  const places = useMemo<Place[]>(() => [...seedPlaces, ...nearbyPois], [seedPlaces, nearbyPois]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [temporaryPin, setTemporaryPin] = useState<TemporaryPin | null>(null);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kvali_recent_searches');
      return saved ? JSON.parse(saved) : ['Colchis Fountain', 'Bagrati', 'Gelati Monastery'];
    } catch {
      return ['Colchis Fountain', 'Bagrati', 'Gelati Monastery'];
    }
  });

  // Route Planning State
  const [routeOrigin, setRouteOrigin] = useState<{ name: string; latitude: number; longitude: number } | null>({
    name: 'Kutaisi Center (Default)',
    latitude: 42.2679,
    longitude: 42.6946,
  });
  const [routeDestination, setRouteDestination] = useState<Place | TemporaryPin | null>(null);
  const [intermediateStops, setIntermediateStops] = useState<(Place | TemporaryPin)[]>([]);
  const [routeAlternatives, setRouteAlternatives] = useState<RouteAlternative[]>([]);
  const [selectedRouteAlternative, setSelectedRouteAlternative] = useState<RouteAlternative | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Road Alerts
  const [roadAlerts, setRoadAlerts] = useState<RoadAlert[]>(() => {
    try {
      const saved = localStorage.getItem('kvali_road_reports');
      const mine: RoadAlert[] = saved ? JSON.parse(saved) : [];
      return [...mine, ...SEED_ALERTS];
    } catch {
      return SEED_ALERTS;
    }
  });
  const [enabledAlertCategories, setEnabledAlertCategories] = useState<Record<AlertCategory, boolean>>(() => {
    try {
      const saved = localStorage.getItem('kvali_alert_cats');
      return saved ? JSON.parse(saved) : DEFAULT_ALERT_CATEGORIES;
    } catch {
      return DEFAULT_ALERT_CATEGORIES;
    }
  });
  const [alertDistanceMeters, setAlertDistanceMetersState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('kvali_alert_dist');
      return saved ? Number(saved) : 400;
    } catch {
      return 400;
    }
  });
  const [beepVolume, setBeepVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('kvali_beep_vol');
      return saved ? Number(saved) : 80;
    } catch {
      return 80;
    }
  });
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('kvali_sound_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Layers & Offline Mode
  const [layers, setLayers] = useState<LayerVisibility>(() => {
    try {
      const saved = localStorage.getItem('kvali_layers');
      return saved ? JSON.parse(saved) : DEFAULT_LAYERS;
    } catch {
      return DEFAULT_LAYERS;
    }
  });
  const [offlineRegions, setOfflineRegions] = useState<OfflineRegion[]>(() => {
    try {
      const saved = localStorage.getItem('kvali_offline_regions');
      return saved ? JSON.parse(saved) : SEED_REGIONS;
    } catch {
      return SEED_REGIONS;
    }
  });
  const [airplaneOfflineMode, setAirplaneOfflineModeState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('kvali_airplane_mode');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  // Saved Places & Collections
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(() => {
    try {
      const saved = localStorage.getItem('kvali_saved_places');
      return saved ? JSON.parse(saved) : INITIAL_SAVED_PLACES;
    } catch {
      return INITIAL_SAVED_PLACES;
    }
  });
  const [collections, setCollections] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kvali_collections');
      return saved ? JSON.parse(saved) : ['Favorites', 'Home', 'Work'];
    } catch {
      return ['Favorites', 'Home', 'Work'];
    }
  });

  // Tracks & Trips
  const [recordedTracks, setRecordedTracks] = useState<RecordedTrack[]>(() => {
    try {
      const saved = localStorage.getItem('kvali_tracks');
      return saved ? JSON.parse(saved) : SEED_TRACKS;
    } catch {
      return SEED_TRACKS;
    }
  });

  // Active Navigation State
  const [activeNav, setActiveNav] = useState<ActiveNavState>({
    isActive: false,
    route: null,
    gpsActive: false,
    offRouteM: 0,
    remainingDistanceKm: 0,
    remainingDurationMinutes: 0,
    currentSpeedKmh: 0,
    speedLimitKmh: 50,
    currentManeuver: {
      instruction: '',
      instructionKa: '',
      roadName: '',
      distanceMeters: 0,
    },
    upcomingAlert: null,
  });

  // Sync theme class to documentElement
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('kvali_theme', theme);
    } catch {}
  }, [theme]);

  // Request the device location (native plugin on Android, browser API on web)
  const requestUserLocation = useCallback(async (): Promise<boolean> => {
    if (geolocationStatus === 'requesting') return false;
    setGeolocationStatus('requesting');
    try {
      const loc = await getCurrentLocation();
      applyLocation(loc);
      setRouteOrigin({
        name: 'My Location (GPS)',
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      setGeolocationStatus('granted');
      setRecenterTrigger((p) => p + 1);
      return true;
    } catch (err) {
      if (err instanceof LocationError && err.kind === 'denied') {
        setGeolocationStatus('denied');
      } else {
        setGeolocationStatus('unavailable');
      }
      return false;
    }
  }, [geolocationStatus]);

  // Continuous geolocation tracking once permission has been granted
  useEffect(() => {
    if (geolocationStatus !== 'granted') return;

    let cancelled = false;
    let stop: (() => void) | null = null;

    watchLocation(
      (loc) => {
        if (!cancelled) applyLocation(loc);
      },
      (err) => {
        if (err.kind === 'denied') setGeolocationStatus('denied');
      }
    ).then((stopFn) => {
      if (cancelled) {
        stopFn();
      } else {
        stop = stopFn;
        stopWatchRef.current = stopFn;
      }
    });

    return () => {
      cancelled = true;
      if (stop) stop();
      stopWatchRef.current = null;
    };
  }, [geolocationStatus]);

  // Nearby points of interest from OpenStreetMap, refreshed for the current area.
  const poiAnchor = userLocation
    ? `${userLocation.latitude.toFixed(2)},${userLocation.longitude.toFixed(2)}`
    : `${defaultCenter.latitude},${defaultCenter.longitude}`;

  useEffect(() => {
    if (!layers.pointsOfInterest) return;

    const [latStr, lonStr] = poiAnchor.split(',');
    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lonStr);
    const controller = new AbortController();

    fetchOverpassPois(latitude, longitude, 4000, controller.signal)
      .then((pois) => {
        const mapped: Place[] = pois.map((poi) => ({
          id: poi.id,
          name: poi.name,
          nameKa: poi.name,
          category: poi.category as PlaceCategory,
          latitude: poi.latitude,
          longitude: poi.longitude,
          description: poi.address || 'OpenStreetMap place',
          descriptionKa: poi.address || 'OpenStreetMap-ის ობიექტი',
          aliases: [],
          demo: false,
          address: poi.address,
        }));
        setNearbyPois(mapped);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setNearbyPois([]);
      });

    return () => controller.abort();
  }, [layers.pointsOfInterest, poiAnchor]);

  // Live Track Recording methods
  const startLiveTrackRecording = useCallback(() => {
    setIsRecordingLiveTrack(true);
    setLiveTrackPoints([]);
    liveTrackStartTime.current = Date.now();
    // Ensure geolocation is active
    if (geolocationStatus !== 'granted') {
      requestUserLocation();
    }
  }, [geolocationStatus, requestUserLocation]);

  const stopAndSaveLiveTrack = useCallback(
    (customTitle?: string) => {
      setIsRecordingLiveTrack(false);
      const points = liveTrackPoints;
      const startTime = liveTrackStartTime.current || Date.now();
      const elapsedMinutes = Math.max(1, Math.round((Date.now() - startTime) / 60000));

      // Calculate approximate distance
      let totalDistanceKm = 0;
      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        if (p1 && p2) {
          const R = 6371;
          const dLat = ((p2[1] - p1[1]) * Math.PI) / 180;
          const dLon = ((p2[0] - p1[0]) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((p1[1] * Math.PI) / 180) *
              Math.cos((p2[1] * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          totalDistanceKm += R * c;
        }
      }

      const dist = parseFloat(Math.max(0.1, totalDistanceKm).toFixed(1));
      const avgSpeed = parseFloat(((dist / (elapsedMinutes / 60)) || 0).toFixed(1));

      const newTrack: RecordedTrack = {
        id: `track-live-${Date.now()}`,
        title: customTitle || `Live GPS Track ${new Date().toLocaleDateString()}`,
        date: new Date().toISOString().split('T')[0],
        distanceKm: dist,
        durationMinutes: elapsedMinutes,
        avgSpeedKmh: avgSpeed,
        coordinates: points.length > 0 ? points : [[42.6946, 42.2679]],
        demo: false,
      };

      setRecordedTracks((prev) => [newTrack, ...prev]);
    },
    [liveTrackPoints]
  );

  // Map Tap with Reverse Geocoding
  const handleMapTapCoords = useCallback(
    async (coords: { latitude: number; longitude: number }) => {
      setTemporaryPin({
        latitude: coords.latitude,
        longitude: coords.longitude,
        title: 'Temporary Pin',
      });
      setSelectedPlace(null);

      // Asynchronously fetch reverse geocoded street name from Nominatim
      try {
        const address = await reverseGeocodeNominatim(coords.latitude, coords.longitude);
        setTemporaryPin((prev) => {
          if (prev && prev.latitude === coords.latitude && prev.longitude === coords.longitude) {
            return {
              ...prev,
              title: address || 'Dropped Pin',
              address,
            };
          }
          return prev;
        });
      } catch {
        // ignore
      }
    },
    []
  );

  // Real OSRM Route Calculation
  const calculateRoutes = useCallback(async (originOverride?: { latitude: number; longitude: number }) => {
    if (!routeDestination) return;

    const origLat = originOverride ? originOverride.latitude : routeOrigin ? routeOrigin.latitude : effectiveCenter.latitude;
    const origLon = originOverride ? originOverride.longitude : routeOrigin ? routeOrigin.longitude : effectiveCenter.longitude;

    const destLat = routeDestination.latitude;
    const destLon = routeDestination.longitude;

    setIsCalculatingRoute(true);
    setRouteError(null);

    const waypoints = intermediateStops.map((s) => ({
      latitude: s.latitude,
      longitude: s.longitude,
    }));

    try {
      // 1. Try real online OSRM routing first
      const osrmRoutes = await fetchOsrmRoute(
        { latitude: origLat, longitude: origLon },
        { latitude: destLat, longitude: destLon },
        waypoints,
        travelMode
      );

      if (osrmRoutes.length > 0) {
        setRouteAlternatives(osrmRoutes);
        setSelectedRouteAlternative(osrmRoutes[0]);
        setIsCalculatingRoute(false);
        return;
      }
    } catch (err) {
      console.warn('Real OSRM route fetch failed, falling back to local geometric route:', err);
    }

    // 2. Fallback to deterministic local route if network is offline
    try {
      const fallbackRoutes = generateRouteAlternatives(
        origLat,
        origLon,
        destLat,
        destLon,
        travelMode,
        routePreferences
      );
      setRouteAlternatives(fallbackRoutes);
      setSelectedRouteAlternative(fallbackRoutes[0]);
    } catch {
      setRouteError('Could not calculate route path.');
    } finally {
      setIsCalculatingRoute(false);
    }
  }, [routeOrigin, routeDestination, intermediateStops, travelMode, routePreferences, effectiveCenter]);

  // Recalculate route whenever destination, origin, mode, or intermediate stops change
  useEffect(() => {
    if (routeDestination) {
      calculateRoutes();
    }
  }, [routeDestination, routeOrigin, travelMode, intermediateStops.length]);

  // Check URL parameters for shareable route links on initial load
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const destParam = params.get('dest');
      const nameParam = params.get('name');
      const modeParam = params.get('mode');

      if (destParam) {
        const [latStr, lonStr] = destParam.split(',');
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);
        if (!isNaN(lat) && !isNaN(lon)) {
          const pin: TemporaryPin = {
            latitude: lat,
            longitude: lon,
            title: nameParam || 'Shared Destination',
          };
          setRouteDestination(pin);
          if (modeParam === 'walking' || modeParam === 'cycling' || modeParam === 'car') {
            setTravelModeState(modeParam);
          }
          setCurrentScreen('route-planning');
        }
      }
    } catch {}
  }, []);

  // Generate shareable route URL
  const getShareableRouteUrl = useCallback((): string => {
    if (!routeDestination) return window.location.href;
    const destLat = routeDestination.latitude;
    const destLon = routeDestination.longitude;
    const destName = 'name' in routeDestination ? routeDestination.name : routeDestination.title || 'Destination';

    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('dest', `${destLat.toFixed(5)},${destLon.toFixed(5)}`);
    url.searchParams.set('name', destName);
    url.searchParams.set('mode', travelMode);
    return url.toString();
  }, [routeDestination, travelMode]);

  // Translation helper
  const t = useCallback(
    (key: string): string => {
      const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
      return dict[key] || TRANSLATIONS.en[key] || key;
    },
    [language]
  );

  // Navigation handlers
  const navigateTo = useCallback((screen: ScreenId) => {
    setCurrentScreen(screen);
    setNavHistory((prev) => (prev[prev.length - 1] === screen ? prev : [...prev, screen]));
  }, []);

  const goBack = useCallback(() => {
    setNavHistory((prev) => {
      if (prev.length <= 1) {
        setCurrentScreen('map');
        return ['map'];
      }
      const newHistory = prev.slice(0, -1);
      const target = newHistory[newHistory.length - 1] || 'map';
      setCurrentScreen(target);
      return newHistory;
    });
  }, []);

  const canGoBack = navHistory.length > 1 || currentScreen !== 'map';

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setLanguage = (lang: Language) => setLanguageState(lang);
  const setTheme = (thm: ThemeMode) => setThemeState(thm);
  const setUnits = (u: UnitSystem) => setUnitsState(u);
  const setVoiceMode = (mode: VoiceMode) => {
    setVoiceModeState(mode);
    try {
      localStorage.setItem('kvali_voice', mode);
    } catch {}
  };
  const setTravelMode = (mode: TravelMode) => setTravelModeState(mode);
  const setAlertDistanceMeters = (m: number) => setAlertDistanceMetersState(m);
  const setBeepVolume = (vol: number) => setBeepVolumeState(vol);
  const setSoundEnabled = (en: boolean) => setSoundEnabledState(en);
  const setAirplaneOfflineMode = (off: boolean) => setAirplaneOfflineModeState(off);

  const toggleAlertCategory = (cat: AlertCategory) => {
    setEnabledAlertCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const persistUserReports = (alerts: RoadAlert[]) => {
    try {
      localStorage.setItem(
        'kvali_road_reports',
        JSON.stringify(alerts.filter((a) => a.source === 'user'))
      );
    } catch {
      /* storage unavailable */
    }
  };

  const reportAlert = (input: {
    category: AlertCategory;
    latitude: number;
    longitude: number;
    description?: string;
    speedLimit?: number;
  }) => {
    const report: RoadAlert = {
      id: `alert-user-${Date.now()}`,
      category: input.category,
      latitude: input.latitude,
      longitude: input.longitude,
      roadName: 'Dropped location',
      roadNameKa: 'მონიშნული ადგილი',
      speedLimit: input.speedLimit,
      warningDistanceMeters: 300,
      source: 'user',
      lastUpdatedText: new Date().toLocaleString(),
      demo: false,
      description: input.description?.trim() || 'Reported by you',
      descriptionKa: input.description?.trim() || 'თქვენ მიერ მოხსენებული',
    };
    setRoadAlerts((prev) => {
      const next = [report, ...prev];
      persistUserReports(next);
      return next;
    });
    return report;
  };

  const removeAlert = (id: string) => {
    setRoadAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      persistUserReports(next);
      return next;
    });
  };

  const toggleLayer = (layer: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const triggerRecenter = () => {
    setRecenterTrigger((prev) => prev + 1);
  };

  // Recent searches
  const addRecentSearch = (query: string) => {
    if (!query.trim()) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== query.toLowerCase());
      const updated = [query.trim(), ...filtered].slice(0, 8);
      try {
        localStorage.setItem('kvali_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('kvali_recent_searches');
    } catch {}
  };

  // Intermediate stops
  const addIntermediateStop = (stop: Place | TemporaryPin) => {
    setIntermediateStops((prev) => [...prev, stop]);
  };

  const removeIntermediateStop = (index: number) => {
    setIntermediateStops((prev) => prev.filter((_, i) => i !== index));
  };

  // Saved places management
  const savePlace = (data: {
    name: string;
    latitude: number;
    longitude: number;
    collection: string;
    note?: string;
    category?: Place['category'];
  }) => {
    const newPlace: SavedPlace = {
      id: 'saved-' + Date.now().toString(),
      name: data.name,
      latitude: data.latitude,
      longitude: data.longitude,
      collection: data.collection || 'Favorites',
      note: data.note,
      category: data.category,
      createdAt: Date.now(),
    };
    setSavedPlaces((prev) => [newPlace, ...prev]);
  };

  const updateSavedPlace = (id: string, updates: Partial<SavedPlace>) => {
    setSavedPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const deleteSavedPlace = (id: string) => {
    setSavedPlaces((prev) => prev.filter((p) => p.id !== id));
  };

  const createCollection = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || collections.includes(trimmed)) return;
    setCollections((prev) => [...prev, trimmed]);
  };

  const importPlacesJson = (jsonData: string): boolean => {
    try {
      const parsed = JSON.parse(jsonData);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].latitude && parsed[0].longitude) {
        setSavedPlaces((prev) => [...parsed, ...prev]);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const updateRegionStatus = (
    id: string,
    action: 'download' | 'pause' | 'resume' | 'cancel' | 'retry' | 'remove' | 'update'
  ) => {
    setOfflineRegions((prev) =>
      prev.map((reg) => {
        if (reg.id !== id) return reg;
        switch (action) {
          case 'download':
          case 'resume':
          case 'retry':
          case 'update':
            return { ...reg, status: 'downloading', downloadProgress: Math.max(10, reg.downloadProgress) };
          case 'pause':
            return { ...reg, status: 'paused' };
          case 'cancel':
          case 'remove':
            return { ...reg, status: 'not_downloaded', downloadProgress: 0 };
          default:
            return reg;
        }
      })
    );
  };

  const patchRegion = (id: string, patch: Partial<OfflineRegion>) => {
    setOfflineRegions((prev) =>
      prev.map((reg) => (reg.id === id ? { ...reg, ...patch } : reg))
    );
  };

  // Trip Tools
  const deleteTrack = (id: string) => {
    setRecordedTracks((prev) => prev.filter((t) => t.id !== id));
  };

  const addSimulatedTrack = () => {
    const newTrack: RecordedTrack = {
      id: 'track-sim-' + Date.now(),
      title: 'Kutaisi - Tskaltubo Scenic Route',
      date: new Date().toISOString().split('T')[0],
      distanceKm: 14.2,
      durationMinutes: 19,
      avgSpeedKmh: 44.8,
      coordinates: [
        [42.7001, 42.2679],
        [42.6738, 42.3129],
        [42.5976, 42.3275],
      ],
      demo: true,
    };
    setRecordedTracks((prev) => [newTrack, ...prev]);
  };

  // Spoken guidance using the Web Speech API (available in the browser and the Android WebView)
  const speak = useCallback(
    (text: string) => {
      try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language === 'ka' ? 'ka-GE' : 'en-US';
        utterance.rate = 1;
        synth.speak(utterance);
      } catch {}
    },
    [language]
  );

  // Audio preview helper using browser Web Audio API
  const playTestBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.12);

      const volumeScale = (beepVolume / 100) * 0.25;
      gain.gain.setValueAtTime(volumeScale, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }, [soundEnabled, beepVolume]);

  // Start live navigation. Progress is driven by GPS fixes, not a timer.
  const startNavigation = (route: RouteAlternative) => {
    const startStep = route.steps && route.steps.length > 1 ? route.steps[1] : route.steps?.[0];
    const initialInstruction = startStep
      ? language === 'ka'
        ? startStep.instructionKa || startStep.instruction
        : startStep.instruction
      : 'Follow the route';

    setActiveNav({
      isActive: true,
      route,
      gpsActive: userLocation !== null,
      offRouteM: 0,
      remainingDistanceKm: route.distanceKm,
      remainingDurationMinutes: route.durationMinutes,
      currentSpeedKmh: userLocation?.speedKmh ?? 0,
      speedLimitKmh: travelMode === 'car' ? 60 : travelMode === 'cycling' ? 25 : 5,
      currentManeuver: {
        instruction: initialInstruction,
        instructionKa: initialInstruction,
        roadName: startStep?.name || route.via || 'Route',
        distanceMeters: startStep?.distanceMeters ?? 0,
      },
      upcomingAlert: roadAlerts[0] || null,
    });
    lastRerouteRef.current = 0;
    navigateTo('active-navigation');
  };

  const endNavigation = () => {
    setActiveNav((prev) => ({ ...prev, isActive: false, route: null, gpsActive: false, offRouteM: 0 }));
    navigateTo('map');
  };

  // Recompute navigation progress on every GPS fix.
  useEffect(() => {
    if (!activeNav.isActive || !activeNav.route || !userLocation) return;

    const progress = computeProgress(activeNav.route, userLocation);
    setActiveNav((prev) => {
      if (!prev.isActive || !prev.route) return prev;
      const step = progress.nextStep;
      return {
        ...prev,
        gpsActive: true,
        offRouteM: Math.round(progress.offRouteM),
        remainingDistanceKm: parseFloat(progress.remainingKm.toFixed(2)),
        remainingDurationMinutes: Math.round(progress.remainingMinutes),
        currentSpeedKmh: userLocation.speedKmh ?? prev.currentSpeedKmh,
        currentManeuver: step
          ? {
              instruction: step.instruction,
              instructionKa: step.instructionKa || step.instruction,
              roadName: step.name,
              distanceMeters: Math.round(progress.distanceToNextStepM),
            }
          : prev.currentManeuver,
      };
    });
  }, [userLocation, activeNav.isActive, activeNav.route]);

  // Re-route when the driver has clearly drifted off the current route.
  useEffect(() => {
    if (!activeNav.isActive || !activeNav.route || !userLocation || !activeNav.gpsActive) return;
    if (activeNav.offRouteM < 60) return;

    const now = Date.now();
    if (now - lastRerouteRef.current < 15000) return;
    lastRerouteRef.current = now;

    calculateRoutes({ latitude: userLocation.latitude, longitude: userLocation.longitude });
  }, [activeNav.isActive, activeNav.route, activeNav.gpsActive, activeNav.offRouteM, userLocation, calculateRoutes]);

  // Keep the active route in sync when a recalculation produces a new one.
  useEffect(() => {
    if (!activeNav.isActive || !selectedRouteAlternative) return;
    setActiveNav((prev) => (prev.isActive ? { ...prev, route: selectedRouteAlternative } : prev));
  }, [selectedRouteAlternative, activeNav.isActive]);

  // Announce each new maneuver when guidance is on.
  useEffect(() => {
    if (!activeNav.isActive) {
      lastSpokenRef.current = '';
      return;
    }
    if (voiceMode === 'muted') return;

    const text =
      language === 'ka'
        ? activeNav.currentManeuver.instructionKa
        : activeNav.currentManeuver.instruction;
    if (!text || text === lastSpokenRef.current) return;
    lastSpokenRef.current = text;

    if (voiceMode === 'spoken') {
      speak(text);
    } else {
      playTestBeep();
    }
  }, [
    activeNav.isActive,
    activeNav.currentManeuver.instruction,
    activeNav.currentManeuver.instructionKa,
    voiceMode,
    language,
    speak,
    playTestBeep,
  ]);

  // Reset prototype data
  const resetPrototypeData = () => {
    try {
      localStorage.clear();
    } catch {}
    setSavedPlaces(INITIAL_SAVED_PLACES);
    setCollections(['Favorites', 'Home', 'Work']);
    setOfflineRegions(SEED_REGIONS);
    setRecordedTracks(SEED_TRACKS);
    setRoadAlerts(SEED_ALERTS);
    setRecentSearches(['Colchis Fountain', 'Bagrati', 'Gelati Monastery']);
    setEnabledAlertCategories(DEFAULT_ALERT_CATEGORIES);
    setLayers(DEFAULT_LAYERS);
    setUnitsState('metric');
    setThemeState('dark');
    setLanguageState('en');
    setVoiceModeState('chime');
    setAirplaneOfflineModeState(false);
    setUserLocation(null);
    setGeolocationStatus('idle');
    setCurrentScreen('map');
    setNavHistory(['map']);
  };

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        navigateTo,
        goBack,
        canGoBack,
        language,
        setLanguage,
        t,
        theme,
        setTheme,
        toggleTheme,
        units,
        setUnits,
        voiceMode,
        setVoiceMode,
        travelMode,
        setTravelMode,
        routePreferences,
        setRoutePreferences,
        userLocation,
        geolocationStatus,
        requestUserLocation,
        effectiveCenter,
        places,
        selectedPlace,
        setSelectedPlace,
        temporaryPin,
        setTemporaryPin,
        recentSearches,
        addRecentSearch,
        clearRecentSearches,
        handleMapTapCoords,
        routeOrigin,
        setRouteOrigin,
        routeDestination,
        setRouteDestination,
        intermediateStops,
        addIntermediateStop,
        removeIntermediateStop,
        routeAlternatives,
        selectedRouteAlternative,
        setSelectedRouteAlternative,
        isCalculatingRoute,
        routeError,
        calculateRoutes,
        getShareableRouteUrl,
        activeNav,
        startNavigation,
        endNavigation,
        roadAlerts,
        enabledAlertCategories,
        toggleAlertCategory,
        reportAlert,
        removeAlert,
        alertDistanceMeters,
        setAlertDistanceMeters,
        beepVolume,
        setBeepVolume,
        soundEnabled,
        setSoundEnabled,
        playTestBeep,
        layers,
        toggleLayer,
        offlineRegions,
        updateRegionStatus,
        patchRegion,
        airplaneOfflineMode,
        setAirplaneOfflineMode,
        savedPlaces,
        collections,
        savePlace,
        updateSavedPlace,
        deleteSavedPlace,
        createCollection,
        importPlacesJson,
        recordedTracks,
        deleteTrack,
        addSimulatedTrack,
        isRecordingLiveTrack,
        startLiveTrackRecording,
        stopAndSaveLiveTrack,
        recenterTrigger,
        triggerRecenter,
        resetPrototypeData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
