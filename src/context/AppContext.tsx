/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
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
import { TRANSLATIONS } from '../lib/translations';
import {
  fetchOsrmRoute,
  fetchOverpassPois,
  fetchOverpassAlerts,
  reverseGeocodeNominatim,
} from '../lib/services';
import {
  getCurrentLocation,
  ensureLocationPermission,
  watchLocation,
  LocationError,
  type LocationResult,
} from '../lib/location';
import { speakText, stopSpeaking } from '../lib/speech';
import { computeProgress } from '../lib/navigation';
import { OffRouteDetector } from '../lib/navigationEngine';
import { calculateDistanceKm } from '../lib/geo';
import { shouldAppendTrackPoint, summariseTrack } from '../lib/trackRecording';
import { isOverspeeding, limitInScope } from '../lib/speed';
import { loadSavedRoute, saveRoute } from '../lib/routeCache';
import { readCache, writeCache } from '../lib/offlineCache';

interface ActiveNavState {
  isActive: boolean;
  route: RouteAlternative | null;
  gpsActive: boolean;
  offRouteM: number;
  remainingDistanceKm: number;
  remainingDurationMinutes: number;
  currentSpeedKmh: number;
  speedLimitKmh: number | null;
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

  // Navigation camera
  navView: '2d' | '3d';
  setNavView: (view: '2d' | '3d') => void;
  northUpLock: boolean;
  setNorthUpLock: (locked: boolean) => void;
  isFollowing: boolean;
  setIsFollowing: (following: boolean) => void;

  // Real Geolocation
  userLocation: UserLocation | null;
  geolocationStatus: GeolocationStatus;
  requestUserLocation: () => Promise<{ latitude: number; longitude: number } | null>;
  effectiveCenter: { latitude: number; longitude: number };
  manualLocation: { latitude: number; longitude: number; name: string } | null;
  setManualLocation: (loc: { latitude: number; longitude: number; name: string } | null) => void;

  // Places, Map Pins & Search
  places: Place[];
  poisUnavailable: boolean;
  selectedPlace: Place | null;
  setSelectedPlace: (place: Place | null) => void;
  temporaryPin: TemporaryPin | null;
  setTemporaryPin: (pin: TemporaryPin | null) => void;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  removeRecentSearch: (query: string) => void;
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
  routeFromCache: boolean;
  isOnline: boolean;
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
  patchRegion: (id: string, patch: Partial<OfflineRegion>) => void;
  addRegion: (region: OfflineRegion) => void;
  removeRegion: (id: string) => void;
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
  addRecordedTrack: (track: RecordedTrack) => void;
  deleteTrack: (id: string) => void;
  isRecordingLiveTrack: boolean;
  startLiveTrackRecording: () => void;
  stopAndSaveLiveTrack: (title?: string) => RecordedTrack | null;

  // Recenter Trigger
  recenterTrigger: number;
  triggerRecenter: () => Promise<void>;

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
  police_station: true,
  stop_sign: true,
  traffic_light: true,
  school_zone: true,
  sharp_curve: true,
};

const DEFAULT_LAYERS: LayerVisibility = {
  pointsOfInterest: true,
  speedCameras: true,
  speedLimits: true,
  communityReports: true,
  savedPlaces: true,
  recordedTracks: true,
  buildings3d: true,
  terrainNotice: false,
};

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
  const didAutoLocateRef = useRef(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Manual location for devices without GPS (or when permission is denied).
  // This is always labelled as manual — it is never presented as a GPS fix.
  const [manualLocation, setManualLocationState] = useState<{
    latitude: number;
    longitude: number;
    name: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('kvali_manual_location');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setManualLocation = useCallback(
    (loc: { latitude: number; longitude: number; name: string } | null) => {
      setManualLocationState(loc);
      try {
        if (loc) localStorage.setItem('kvali_manual_location', JSON.stringify(loc));
        else localStorage.removeItem('kvali_manual_location');
      } catch {}
    },
    []
  );

  // Live Track Recording
  const [isRecordingLiveTrack, setIsRecordingLiveTrack] = useState(false);
  const [liveTrackPoints, setLiveTrackPoints] = useState<[number, number][]>([]);
  const liveTrackStartTime = useRef<number | null>(null);
  const lastTrackPoint = useRef<{ latitude: number; longitude: number } | null>(null);
  const isRecordingRef = useRef(false);
  const offRouteDetectorRef = useRef(new OffRouteDetector());
  const lastSpokenRef = useRef('');
  const lastOverSpeedBeepRef = useRef(0);

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
      const next = { latitude: loc.latitude, longitude: loc.longitude };
      if (shouldAppendTrackPoint(lastTrackPoint.current, next)) {
        lastTrackPoint.current = next;
        setLiveTrackPoints((prev) => [...prev, [loc.longitude, loc.latitude]]);
      }
    }
  }, []);

  // Default Kutaisi Center: 42.2679, 42.6946 (used only until a real or manual position exists)
  const defaultCenter = { latitude: 42.2679, longitude: 42.6946 };
  const effectiveCenter = userLocation
    ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
    : manualLocation
    ? { latitude: manualLocation.latitude, longitude: manualLocation.longitude }
    : defaultCenter;

  const [recenterTrigger, setRecenterTrigger] = useState<number>(0);

  // Places from OpenStreetMap around the current area, plus dropped pins.
  const [nearbyPois, setNearbyPois] = useState<Place[]>([]);
  const [poisUnavailable, setPoisUnavailable] = useState(false);
  const places = nearbyPois;
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [temporaryPin, setTemporaryPin] = useState<TemporaryPin | null>(null);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kvali_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Route Planning State
  const [routeOrigin, setRouteOrigin] = useState<{ name: string; latitude: number; longitude: number } | null>(null);
  const [routeDestination, setRouteDestination] = useState<Place | TemporaryPin | null>(null);
  const [intermediateStops, setIntermediateStops] = useState<(Place | TemporaryPin)[]>([]);
  const [routeAlternatives, setRouteAlternatives] = useState<RouteAlternative[]>([]);
  const [selectedRouteAlternative, setSelectedRouteAlternative] = useState<RouteAlternative | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeFromCache, setRouteFromCache] = useState(false);

  // Road Alerts
  const [roadAlerts, setRoadAlerts] = useState<RoadAlert[]>(() => {
    try {
      const saved = localStorage.getItem('kvali_road_reports');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  // Real enforcement / hazard features read from OpenStreetMap (not persisted).
  const [mappedAlerts, setMappedAlerts] = useState<RoadAlert[]>([]);
  const [enabledAlertCategories, setEnabledAlertCategories] = useState<Record<AlertCategory, boolean>>(() => {
    try {
      const saved = localStorage.getItem('kvali_alert_cats');
      return saved ? { ...DEFAULT_ALERT_CATEGORIES, ...JSON.parse(saved) } : DEFAULT_ALERT_CATEGORIES;
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
      return saved ? { ...DEFAULT_LAYERS, ...JSON.parse(saved) } : DEFAULT_LAYERS;
    } catch {
      return DEFAULT_LAYERS;
    }
  });
  const [offlineRegions, setOfflineRegions] = useState<OfflineRegion[]>(() => {
    try {
      const saved = localStorage.getItem('kvali_offline_regions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
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

  // Navigation camera preferences
  const [navView, setNavViewState] = useState<'2d' | '3d'>(() => {
    try {
      return localStorage.getItem('kvali_nav_view') === '2d' ? '2d' : '3d';
    } catch {
      return '3d';
    }
  });
  const [northUpLock, setNorthUpLockState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kvali_north_up') === 'true';
    } catch {
      return false;
    }
  });
  const [isFollowing, setIsFollowingState] = useState<boolean>(true);

  const setNavView = useCallback((view: '2d' | '3d') => setNavViewState(view), []);
  const setNorthUpLock = useCallback((locked: boolean) => setNorthUpLockState(locked), []);
  const setIsFollowing = useCallback((following: boolean) => setIsFollowingState(following), []);

  useEffect(() => {
    try {
      localStorage.setItem('kvali_nav_view', navView);
    } catch {}
  }, [navView]);

  useEffect(() => {
    try {
      localStorage.setItem('kvali_north_up', String(northUpLock));
    } catch {}
  }, [northUpLock]);

  // Saved Places & Collections
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(() => {
    try {
      const saved = localStorage.getItem('kvali_saved_places');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
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
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
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
    speedLimitKmh: null,
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

  useEffect(() => {
    try {
      localStorage.setItem('kvali_lang', language);
    } catch {}
  }, [language]);

  useEffect(() => {
    try {
      localStorage.setItem('kvali_units', units);
    } catch {}
  }, [units]);

  // Persist the rest of the user's preferences and their own data so nothing
  // silently resets when the app is reopened.
  useEffect(() => {
    try {
      localStorage.setItem('kvali_layers', JSON.stringify(layers));
      localStorage.setItem('kvali_saved_places', JSON.stringify(savedPlaces));
      localStorage.setItem('kvali_collections', JSON.stringify(collections));
      localStorage.setItem('kvali_tracks', JSON.stringify(recordedTracks));
      localStorage.setItem('kvali_alert_cats', JSON.stringify(enabledAlertCategories));
      localStorage.setItem('kvali_alert_dist', String(alertDistanceMeters));
      localStorage.setItem('kvali_beep_vol', String(beepVolume));
      localStorage.setItem('kvali_sound_enabled', String(soundEnabled));
      localStorage.setItem('kvali_airplane_mode', String(airplaneOfflineMode));
      localStorage.setItem('kvali_mode', travelMode);
      localStorage.setItem('kvali_route_pref', JSON.stringify(routePreferences));
    } catch {}
  }, [
    layers,
    savedPlaces,
    collections,
    recordedTracks,
    enabledAlertCategories,
    alertDistanceMeters,
    beepVolume,
    soundEnabled,
    airplaneOfflineMode,
    travelMode,
    routePreferences,
  ]);

  // Request the device location (native plugin on Android, browser API on web)
  const requestUserLocation = useCallback(async (): Promise<{ latitude: number; longitude: number } | null> => {
    if (geolocationStatus === 'requesting') return null;
    setGeolocationStatus('requesting');

    let granted = false;
    try {
      granted = await ensureLocationPermission();
    } catch {
      setGeolocationStatus('unavailable');
      return null;
    }

    if (!granted) {
      setGeolocationStatus('denied');
      return null;
    }

    // Permission is granted: start continuous tracking right away. A single
    // getCurrentPosition() call can time out indoors, and that must not stop
    // the GPS from ever activating.
    setGeolocationStatus('granted');

    try {
      const loc = await getCurrentLocation();
      applyLocation(loc);
      setManualLocation(null);
      setRouteOrigin({
        name: 'My Location (GPS)',
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      setRecenterTrigger((p) => p + 1);
      return { latitude: loc.latitude, longitude: loc.longitude };
    } catch (err) {
      if (err instanceof LocationError && err.kind === 'denied') {
        setGeolocationStatus('denied');
      }
      // Otherwise the watch may still deliver a fix; keep waiting for it.
      return null;
    }
  }, [geolocationStatus, setManualLocation]);

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
    }).catch(() => {
      if (!cancelled) setGeolocationStatus('unavailable');
    });

    return () => {
      cancelled = true;
      if (stop) stop();
      stopWatchRef.current = null;
    };
  }, [geolocationStatus]);

  // Ask for the device position once on launch so GPS actually activates.
  // If the user already chose a manual location we leave it untouched.
  useEffect(() => {
    if (didAutoLocateRef.current) return;
    didAutoLocateRef.current = true;
    if (!manualLocation) requestUserLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nearby points of interest from OpenStreetMap, refreshed for the current area.
  const poiAnchor = `${effectiveCenter.latitude.toFixed(2)},${effectiveCenter.longitude.toFixed(2)}`;

  useEffect(() => {
    if (!layers.pointsOfInterest) return;

    const cached = readCache<Place[]>(`poi:${poiAnchor}`, 7 * 24 * 60 * 60 * 1000);
    if (cached) setNearbyPois(cached);

    // Offline (or offline mode): keep whatever was downloaded with the area.
    if (airplaneOfflineMode || !isOnline) return;

    const [latStr, lonStr] = poiAnchor.split(',');
    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lonStr);
    let controller = new AbortController();
    let retryTimer: number | null = null;
    let cancelled = false;

    const load = (attempt: number) => {
      controller = new AbortController();
      fetchOverpassPois(latitude, longitude, 4000, controller.signal)
        .then((pois) => {
          if (cancelled) return;
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
            address: poi.address,
          }));
          if (mapped.length > 0) {
            setNearbyPois(mapped);
            writeCache(`poi:${poiAnchor}`, mapped);
            setPoisUnavailable(false);
          } else if (!cached) {
            setPoisUnavailable(true);
          }
        })
        .catch((err) => {
          if (err?.name === 'AbortError' || cancelled) return;
          // Keep the last known POIs on screen instead of blanking the map.
          if (attempt < 2) {
            retryTimer = window.setTimeout(() => load(attempt + 1), 4000 * (attempt + 1));
          } else if (!cached) {
            setPoisUnavailable(true);
          }
        });
    };

    load(0);

    return () => {
      cancelled = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      controller.abort();
    };
  }, [layers.pointsOfInterest, poiAnchor, airplaneOfflineMode, isOnline]);

  // Real mapped enforcement and hazards from OpenStreetMap, refreshed per area.
  useEffect(() => {
    const cached = readCache<RoadAlert[]>(`alerts:${poiAnchor}`, 7 * 24 * 60 * 60 * 1000);
    if (cached) setMappedAlerts(cached);

    if (airplaneOfflineMode || !isOnline) return;

    const [latStr, lonStr] = poiAnchor.split(',');
    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lonStr);
    const controller = new AbortController();

    fetchOverpassAlerts(latitude, longitude, 6000, controller.signal)
      .then((rows) => {
        const mapped: RoadAlert[] = rows.map((row) => ({
          id: row.id,
          category: row.category,
          latitude: row.latitude,
          longitude: row.longitude,
          roadName: row.roadName,
          roadNameKa: row.roadName,
          speedLimit: row.speedLimit,
          warningDistanceMeters: 400,
          source: 'mapped' as const,
          lastUpdatedText: row.lastUpdatedText,
          description: row.description,
          descriptionKa: row.descriptionKa,
        }));
        setMappedAlerts(mapped);
        writeCache(`alerts:${poiAnchor}`, mapped);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        if (!cached) setMappedAlerts([]);
      });

    return () => controller.abort();
  }, [poiAnchor, airplaneOfflineMode, isOnline]);

  const allAlerts = useMemo<RoadAlert[]>(() => {
    const userIds = new Set(roadAlerts.map((a) => a.id));
    return [...mappedAlerts.filter((a) => !userIds.has(a.id)), ...roadAlerts];
  }, [mappedAlerts, roadAlerts]);

  // Live Track Recording methods
  const startLiveTrackRecording = useCallback(() => {
    setIsRecordingLiveTrack(true);
    setLiveTrackPoints([]);
    lastTrackPoint.current = null;
    liveTrackStartTime.current = Date.now();
    // Ensure geolocation is active
    if (geolocationStatus !== 'granted') {
      requestUserLocation();
    }
  }, [geolocationStatus, requestUserLocation]);

  const stopAndSaveLiveTrack = useCallback(
    (customTitle?: string): RecordedTrack | null => {
      setIsRecordingLiveTrack(false);
      const points = liveTrackPoints;
      const startTime = liveTrackStartTime.current || Date.now();

      if (points.length < 2) {
        lastTrackPoint.current = null;
        return null;
      }

      const summary = summariseTrack(points, Date.now() - startTime);

      const newTrack: RecordedTrack = {
        id: `track-live-${Date.now()}`,
        title: customTitle || `Live GPS Track ${new Date().toLocaleDateString()}`,
        date: new Date().toISOString().split('T')[0],
        distanceKm: summary.distanceKm,
        durationMinutes: summary.durationMinutes,
        avgSpeedKmh: summary.avgSpeedKmh,
        coordinates: points,
      };

      setRecordedTracks((prev) => [newTrack, ...prev]);
      lastTrackPoint.current = null;
      return newTrack;
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

  // Real OSRM route calculation. If no real origin is known we refuse to
  // calculate instead of inventing a start point from the default map centre.
  const calculateRoutes = useCallback(async (originOverride?: { latitude: number; longitude: number }) => {
    if (!routeDestination) return;

    const origin =
      originOverride ??
      (routeOrigin ? { latitude: routeOrigin.latitude, longitude: routeOrigin.longitude } : null) ??
      (userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : null) ??
      (manualLocation ? { latitude: manualLocation.latitude, longitude: manualLocation.longitude } : null);

    if (!origin) {
      setRouteAlternatives([]);
      setSelectedRouteAlternative(null);
      setRouteError(
        language === 'ka'
          ? 'დასაწყისი წერტილი არ არის მითითებული. ჩართეთ მდებარეობა ან აირჩიეთ ის ხელით.'
          : 'No starting point. Enable location or set your position manually.'
      );
      return;
    }

    const destLat = routeDestination.latitude;
    const destLon = routeDestination.longitude;

    setIsCalculatingRoute(true);
    setRouteError(null);

    const waypoints = intermediateStops.map((s) => ({
      latitude: s.latitude,
      longitude: s.longitude,
    }));
    const destination = { latitude: destLat, longitude: destLon };
    const offline = airplaneOfflineMode || !isOnline;
    const cached = loadSavedRoute(origin, destination, waypoints, travelMode, routePreferences);

    if (offline) {
      if (cached) {
        setRouteAlternatives(cached);
        setSelectedRouteAlternative(cached[0]);
        setRouteFromCache(true);
        setRouteError(null);
      } else {
        setRouteAlternatives([]);
        setSelectedRouteAlternative(null);
        setRouteFromCache(false);
        setRouteError(
          language === 'ka'
            ? 'ამ მარშრუტის შენახული ასლი არ არის. გამორთეთ ოფლაინ რეჟიმი, გამოთვალეთ მარშრუტი ერთხელ და შემდეგ ის ოფლაინაც იმუშავებს.'
            : 'This route is not saved yet. Turn off offline mode, calculate it once, and it will work offline afterwards.'
        );
      }
      setIsCalculatingRoute(false);
      return;
    }

    try {
      const osrmRoutes = await fetchOsrmRoute(
        origin,
        destination,
        waypoints,
        travelMode,
        routePreferences
      );

      if (osrmRoutes.length > 0) {
        setRouteAlternatives(osrmRoutes);
        setSelectedRouteAlternative(osrmRoutes[0]);
        setRouteFromCache(false);
        saveRoute(origin, destination, waypoints, travelMode, osrmRoutes, routePreferences);
        return;
      }

      setRouteAlternatives([]);
      setSelectedRouteAlternative(null);
      setRouteFromCache(false);
      setRouteError(
        language === 'ka' ? 'ამ მოგზაურობისთვის მარშრუტი ვერ მოიძებნა.' : 'No route found for this trip.'
      );
    } catch (err) {
      console.warn('Route request failed:', err);
      if (cached) {
        setRouteAlternatives(cached);
        setSelectedRouteAlternative(cached[0]);
        setRouteFromCache(true);
        setRouteError(null);
      } else {
        setRouteAlternatives([]);
        setSelectedRouteAlternative(null);
        setRouteFromCache(false);
        setRouteError(
          language === 'ka'
            ? 'მარშრუტის სერვისი მიუწვდომელია. შეამოწმეთ კავშირი და სცადეთ თავიდან.'
            : 'Routing service unavailable. Check your connection and try again.'
        );
      }
    } finally {
      setIsCalculatingRoute(false);
    }
  }, [
    routeOrigin,
    routeDestination,
    intermediateStops,
    travelMode,
    userLocation,
    manualLocation,
    language,
    airplaneOfflineMode,
    isOnline,
  ]);

  // Recalculate route whenever destination, origin, mode, preferences or stops change
  useEffect(() => {
    if (routeDestination) {
      calculateRoutes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeDestination, routeOrigin, travelMode, routePreferences, intermediateStops.length, manualLocation]);

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

  const triggerRecenter = async () => {
    // If we have no position yet, ask for one before centring on it.
    if (!userLocation && !manualLocation) {
      const loc = await requestUserLocation();
      if (!loc) return;
    }
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

  const removeRecentSearch = (query: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s.toLowerCase() !== query.toLowerCase());
      try {
        if (updated.length) {
          localStorage.setItem('kvali_recent_searches', JSON.stringify(updated));
        } else {
          localStorage.removeItem('kvali_recent_searches');
        }
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
      if (!Array.isArray(parsed) || parsed.length === 0) return false;

      const valid: SavedPlace[] = parsed
        .filter(
          (entry: unknown): entry is Record<string, unknown> =>
            !!entry &&
            typeof entry === 'object' &&
            typeof (entry as SavedPlace).name === 'string' &&
            Number.isFinite(Number((entry as SavedPlace).latitude)) &&
            Number.isFinite(Number((entry as SavedPlace).longitude))
        )
        .map((entry, index) => ({
          id: typeof entry.id === 'string' ? entry.id : `saved-import-${Date.now()}-${index}`,
          name: String(entry.name),
          latitude: Number(entry.latitude),
          longitude: Number(entry.longitude),
          collection: typeof entry.collection === 'string' ? entry.collection : 'Favorites',
          note: typeof entry.note === 'string' ? entry.note : undefined,
          category: entry.category as SavedPlace['category'],
          createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : Date.now(),
        }));

      if (valid.length === 0) return false;
      setSavedPlaces((prev) => [...valid, ...prev]);
      return true;
    } catch {
      return false;
    }
  };

  const patchRegion = (id: string, patch: Partial<OfflineRegion>) => {
    setOfflineRegions((prev) => {
      const next = prev.map((reg) => (reg.id === id ? { ...reg, ...patch } : reg));
      try {
        localStorage.setItem('kvali_offline_regions', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const addRegion = (region: OfflineRegion) => {
    setOfflineRegions((prev) => {
      const next = [...prev, region];
      try {
        localStorage.setItem('kvali_offline_regions', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const removeRegion = (id: string) => {
    setOfflineRegions((prev) => {
      const next = prev.filter((reg) => reg.id !== id);
      try {
        localStorage.setItem('kvali_offline_regions', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Trip Tools
  const addRecordedTrack = useCallback((track: RecordedTrack) => {
    setRecordedTracks((prev) => [track, ...prev]);
  }, []);

  const deleteTrack = (id: string) => {
    setRecordedTracks((prev) => prev.filter((t) => t.id !== id));
  };

  // Spoken guidance: native Android TTS (with a selected Georgian voice) on
  // device, browser speechSynthesis on the web.
  const speak = useCallback(
    (text: string) => {
      void speakText(text, language);
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

  // One chime when the driver crosses the limit, then at most once a minute.
  // The GPS speed wobbles around the tolerance, so a naive effect would beep
  // constantly at the boundary.
  useEffect(() => {
    if (!activeNav.isActive) {
      lastOverSpeedBeepRef.current = 0;
      return;
    }
    if (!isOverspeeding(activeNav.currentSpeedKmh, activeNav.speedLimitKmh)) return;
    const now = Date.now();
    if (now - lastOverSpeedBeepRef.current < 60_000) return;
    lastOverSpeedBeepRef.current = now;
    playTestBeep();
  }, [
    activeNav.isActive,
    activeNav.currentSpeedKmh,
    activeNav.speedLimitKmh,
    playTestBeep,
  ]);
  const findUpcomingAlert = useCallback(
    (loc: { latitude: number; longitude: number }): RoadAlert | null => {
      let nearest: RoadAlert | null = null;
      let bestMeters = Infinity;
      for (const alert of allAlerts) {
        if (!enabledAlertCategories[alert.category]) continue;
        const meters =
          calculateDistanceKm(loc.latitude, loc.longitude, alert.latitude, alert.longitude) * 1000;
        if (meters <= alertDistanceMeters && meters < bestMeters) {
          bestMeters = meters;
          nearest = alert;
        }
      }
      return nearest;
    },
    [allAlerts, enabledAlertCategories, alertDistanceMeters]
  );

  // Start live navigation. Progress is driven by GPS fixes, not a timer.
  const startNavigation = (route: RouteAlternative) => {
    const startStep = route.steps && route.steps.length > 1 ? route.steps[1] : route.steps?.[0];
    const initialInstruction = startStep
      ? language === 'ka'
        ? startStep.instructionKa || startStep.instruction
        : startStep.instruction
      : 'Follow the route';

    const initialAlert = userLocation ? findUpcomingAlert(userLocation) : null;
    const initialAlertMeters =
      initialAlert && userLocation
        ? calculateDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            initialAlert.latitude,
            initialAlert.longitude
          ) * 1000
        : Infinity;

    setActiveNav({
      isActive: true,
      route,
      gpsActive: userLocation !== null,
      offRouteM: 0,
      remainingDistanceKm: route.distanceKm,
      remainingDurationMinutes: route.durationMinutes,
      currentSpeedKmh: userLocation?.speedKmh ?? 0,
      speedLimitKmh: limitInScope(initialAlert?.speedLimit, initialAlertMeters),
      currentManeuver: {
        instruction: initialInstruction,
        instructionKa: initialInstruction,
        roadName: startStep?.name || route.via || 'Route',
        distanceMeters: startStep?.distanceMeters ?? 0,
      },
      upcomingAlert: initialAlert,
    });
    offRouteDetectorRef.current.reset();
    setIsFollowing(true);
    setRecenterTrigger((prev) => prev + 1);
    navigateTo('active-navigation');
  };

  const endNavigation = () => {
    void stopSpeaking();
    setIsFollowing(true);
    setActiveNav((prev) => ({ ...prev, isActive: false, route: null, gpsActive: false, offRouteM: 0 }));
    navigateTo('map');
  };

  // Recompute navigation progress on every GPS fix.
  useEffect(() => {
    if (!activeNav.isActive || !activeNav.route || !userLocation) return;

    const progress = computeProgress(activeNav.route, userLocation);
    const upcoming = findUpcomingAlert(userLocation);
    const upcomingMeters = upcoming
      ? calculateDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          upcoming.latitude,
          upcoming.longitude
        ) * 1000
      : Infinity;
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
        speedLimitKmh: limitInScope(upcoming?.speedLimit, upcomingMeters),
        upcomingAlert: upcoming,
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
  }, [userLocation, activeNav.isActive, activeNav.route, findUpcomingAlert]);

  // Re-route when the driver has clearly drifted off the current route.
  // OffRouteDetector owns the speed-dependent threshold, the three-second
  // debounce and the cooldown between reroutes.
  useEffect(() => {
    if (!activeNav.isActive || !activeNav.route || !userLocation || !activeNav.gpsActive) {
      offRouteDetectorRef.current.reset();
      return;
    }

    const decision = offRouteDetectorRef.current.update(
      activeNav.offRouteM,
      userLocation.speedKmh ?? activeNav.currentSpeedKmh
    );
    if (!decision.reroute) return;

    calculateRoutes({ latitude: userLocation.latitude, longitude: userLocation.longitude });
  }, [
    activeNav.isActive,
    activeNav.route,
    activeNav.gpsActive,
    activeNav.offRouteM,
    activeNav.currentSpeedKmh,
    userLocation,
    calculateRoutes,
  ]);

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
    setSavedPlaces([]);
    setCollections(['Favorites', 'Home', 'Work']);
    setOfflineRegions([]);
    setRecordedTracks([]);
    setRoadAlerts([]);
    setRecentSearches([]);
    setEnabledAlertCategories(DEFAULT_ALERT_CATEGORIES);
    setLayers(DEFAULT_LAYERS);
    setUnitsState('metric');
    setThemeState('dark');
    setLanguageState('en');
    setVoiceModeState('chime');
    setAirplaneOfflineModeState(false);
    setUserLocation(null);
    setManualLocation(null);
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
        navView,
        setNavView,
        northUpLock,
        setNorthUpLock,
        isFollowing,
        setIsFollowing,
        userLocation,
        geolocationStatus,
        requestUserLocation,
        effectiveCenter,
        manualLocation,
        setManualLocation,
        places,
        poisUnavailable,
        selectedPlace,
        setSelectedPlace,
        temporaryPin,
        setTemporaryPin,
        recentSearches,
        addRecentSearch,
        removeRecentSearch,
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
        routeFromCache,
        isOnline,
        calculateRoutes,
        getShareableRouteUrl,
        activeNav,
        startNavigation,
        endNavigation,
        roadAlerts: allAlerts,
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
        patchRegion,
        addRegion,
        removeRegion,
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
        addRecordedTrack,
        deleteTrack,
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
