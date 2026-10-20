import { RouteStep } from '../lib/services';

export type Language = 'en' | 'ka';
export type ThemeMode = 'light' | 'dark';
export type UnitSystem = 'metric' | 'imperial';
export type TravelMode = 'car' | 'walking' | 'cycling';
export type VoiceMode = 'chime' | 'spoken' | 'muted';

export type ScreenId =
  | 'map'
  | 'search'
  | 'route-planning'
  | 'active-navigation'
  | 'road-alerts'
  | 'offline-maps'
  | 'saved-places'
  | 'map-layers'
  | 'settings'
  | 'trip-tools'
  | 'about';

export type PlaceCategory =
  | 'fuel'
  | 'parking'
  | 'food'
  | 'hotels'
  | 'hospital'
  | 'atm'
  | 'ev_charging'
  | 'viewpoints'
  | 'pharmacies'
  | 'groceries'
  | 'attractions'
  | 'hiking'
  | 'place'
  | 'poi';

export interface Place {
  id: string;
  name: string;
  nameKa: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
  description: string;
  descriptionKa: string;
  aliases: string[];
  address?: string;
}

export type AlertCategory =
  | 'fixed_speed_camera'
  | 'average_speed_zone'
  | 'red_light_camera'
  | 'combined_camera'
  | 'enforcement_other'
  | 'speed_limit_change'
  | 'roadworks'
  | 'accidents'
  | 'road_closures'
  | 'broken_down_vehicle'
  | 'dangerous_conditions'
  | 'lane_restrictions'
  | 'community_reports'
  | 'mobile_police'
  | 'police_station'
  | 'stop_sign'
  | 'traffic_light'
  | 'school_zone'
  | 'sharp_curve';

export interface RoadAlert {
  id: string;
  category: AlertCategory;
  latitude: number;
  longitude: number;
  roadName: string;
  roadNameKa: string;
  speedLimit?: number; // km/h
  warningDistanceMeters: number;
  source: 'mapped' | 'community' | 'unverified' | 'user';
  lastUpdatedText: string;
  description: string;
  descriptionKa: string;
}

export interface RouteAlternative {
  id: string;
  name: string;
  nameKa?: string;
  distanceKm: number;
  durationMinutes: number;
  via: string;
  viaKa?: string;
  coordinates: [number, number][]; // [lng, lat]
  preferenceNote?: string;
  preferenceNoteKa?: string;
  steps?: RouteStep[];
  isRealService?: boolean;
}

export interface RoutePreferences {
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidUnpaved: boolean;
}

export interface SavedPlace {
  id: string;
  name: string;
  collection: string;
  latitude: number;
  longitude: number;
  category?: PlaceCategory;
  note?: string;
  createdAt: number;
}

export interface OfflineRegion {
  id: string;
  name: string;
  nameKa: string;
  sizeMb: number; // approximate estimate shown before download
  bbox: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
  status: 'not_downloaded' | 'downloading' | 'paused' | 'downloaded' | 'update_available';
  downloadProgress: number; // 0 to 100
  lastUpdated: string;
  bytes?: number; // real size once downloaded
}

export interface RecordedTrack {
  id: string;
  title: string;
  date: string;
  distanceKm: number;
  durationMinutes: number;
  avgSpeedKmh: number;
  coordinates: [number, number][]; // [lng, lat]
}

export interface LayerVisibility {
  pointsOfInterest: boolean;
  speedCameras: boolean;
  speedLimits: boolean;
  communityReports: boolean;
  savedPlaces: boolean;
  recordedTracks: boolean;
  buildings3d: boolean;
  terrainNotice: boolean;
}

export interface TemporaryPin {
  latitude: number;
  longitude: number;
  title?: string;
  address?: string;
}

export type GeolocationStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable';

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  speedKmh?: number | null;
  headingDegrees?: number | null;
  timestamp: number;
}
