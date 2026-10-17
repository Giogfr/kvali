import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import maplibreglWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useApp } from '../../context/AppContext';
import { FallbackMap } from './FallbackMap';
import { Place } from '../../types';

// Configure MapLibre Web Worker URL via Vite asset bundler
try {
  if (typeof (maplibregl as any).setWorkerUrl === 'function' && maplibreglWorkerUrl) {
    (maplibregl as any).setWorkerUrl(maplibreglWorkerUrl);
  }
} catch (err) {
  console.warn('Could not set MapLibre workerUrl:', err);
}

interface MapViewProps {
  onTapLocation?: (coords: { latitude: number; longitude: number }) => void;
  onSelectPlace?: (place: Place | null) => void;
  activeRouteCoordinates?: [number, number][]; // [lng, lat]
}

function checkWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl') ||
        canvas.getContext('webgl2'))
    );
  } catch {
    return false;
  }
}

export const MapView: React.FC<MapViewProps> = ({
  onTapLocation,
  onSelectPlace,
  activeRouteCoordinates,
}) => {
  const {
    theme,
    airplaneOfflineMode,
    effectiveCenter,
    recenterTrigger,
    selectedPlace,
    setSelectedPlace,
    temporaryPin,
    setTemporaryPin,
    savedPlaces,
    roadAlerts,
    places,
    layers,
    enabledAlertCategories,
  } = useApp();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [hasInitError, setHasInitError] = useState(false);
  const [styleNotice, setStyleNotice] = useState<string | null>(null);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);

  // Style URLs
  const primaryLightStyle = 'https://tiles.openfreemap.org/styles/positron';
  const primaryDarkStyle = 'https://tiles.openfreemap.org/styles/dark';
  const demoFallbackStyle = 'https://demotiles.maplibre.org/style.json';

  const getTargetStyle = useCallback(() => {
    return theme === 'dark' ? primaryDarkStyle : primaryLightStyle;
  }, [theme]);

  // Initialize MapLibre
  useEffect(() => {
    // If airplane offline mode is simulated, bypass WebGL map to show fallback
    if (airplaneOfflineMode) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    if (!checkWebGL()) {
      setHasInitError(true);
      return;
    }

    if (!mapContainerRef.current) return;

    let isSubscribed = true;
    const initialStyle = getTargetStyle();

    // Safety timeout in case tile fetching hangs
    const timeoutTimer = setTimeout(() => {
      if (isSubscribed && !isStyleLoaded && !mapInstanceRef.current?.loaded()) {
        setStyleNotice('Low-detail demo style');
        try {
          mapInstanceRef.current?.setStyle(demoFallbackStyle);
        } catch {
          // ignore
        }
      }
    }, 4500);

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: initialStyle,
        center: [effectiveCenter.longitude, effectiveCenter.latitude],
        zoom: 14,
        attributionControl: false,
      });

      // Add standard attribution control
      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: '© OpenStreetMap · OpenFreeMap',
        }),
        'bottom-right'
      );

      // Handle map errors & fallback style
      map.on('error', (e: any) => {
        if (!isSubscribed) return;
        const msg = e?.error?.message || e?.message || (typeof e === 'string' ? e : '');
        if (
          msg.includes('Worker failed to load') ||
          msg.includes('worker') ||
          msg.includes('WebGL') ||
          msg.includes('GPU') ||
          msg.includes('context')
        ) {
          console.warn('MapLibre worker or WebGL error, switching to FallbackMap:', msg);
          setHasInitError(true);
        } else if (
          msg.includes('style') ||
          msg.includes('404') ||
          msg.includes('Failed to fetch') ||
          msg.includes('NetworkError')
        ) {
          try {
            setStyleNotice('Low-detail demo style');
            map.setStyle(demoFallbackStyle);
          } catch {
            setHasInitError(true);
          }
        }
      });

      map.on('load', () => {
        if (!isSubscribed) return;
        setIsStyleLoaded(true);
        clearTimeout(timeoutTimer);
      });

      // Tap on map to drop temporary pin
      map.on('click', (e: any) => {
        if (!isSubscribed) return;
        try {
          const coords = {
            latitude: parseFloat(e.lngLat.lat.toFixed(5)),
            longitude: parseFloat(e.lngLat.lng.toFixed(5)),
          };
          setTemporaryPin(coords);
          setSelectedPlace(null);
          if (onTapLocation) {
            onTapLocation(coords);
          }
        } catch {
          // ignore
        }
      });

      mapInstanceRef.current = map;
    } catch {
      setHasInitError(true);
    }

    return () => {
      isSubscribed = false;
      clearTimeout(timeoutTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [airplaneOfflineMode]);

  // Update theme style if map is initialized
  useEffect(() => {
    if (!mapInstanceRef.current || airplaneOfflineMode || hasInitError) return;
    try {
      setIsStyleLoaded(false);
      mapInstanceRef.current.setStyle(getTargetStyle());
      mapInstanceRef.current.once('style.load', () => {
        setIsStyleLoaded(true);
      });
    } catch {}
  }, [theme, getTargetStyle, airplaneOfflineMode, hasInitError]);

  // Recenter map animation
  useEffect(() => {
    if (!mapInstanceRef.current || recenterTrigger === 0 || hasInitError) return;
    try {
      mapInstanceRef.current.flyTo({
        center: [effectiveCenter.longitude, effectiveCenter.latitude],
        zoom: 14.5,
        essential: true,
        duration: 1200,
      });
    } catch {}
  }, [recenterTrigger, effectiveCenter, hasInitError]);

  // Focus map on selected place
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedPlace || hasInitError) return;
    try {
      mapInstanceRef.current.flyTo({
        center: [selectedPlace.longitude, selectedPlace.latitude],
        zoom: 15,
        duration: 1000,
      });
    } catch {}
  }, [selectedPlace, hasInitError]);

  // Focus map on temporary pin
  useEffect(() => {
    if (!mapInstanceRef.current || !temporaryPin || hasInitError) return;
    try {
      mapInstanceRef.current.flyTo({
        center: [temporaryPin.longitude, temporaryPin.latitude],
        zoom: 15,
        duration: 800,
      });
    } catch {}
  }, [temporaryPin, hasInitError]);

  // Render HTML markers onto MapLibre
  const updateMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || hasInitError) return;

    try {
      // Remove existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // 1. Simulated GPS indicator with heading cone
      const gpsEl = document.createElement('div');
      gpsEl.className = 'relative flex items-center justify-center cursor-pointer pointer-events-auto';
      gpsEl.innerHTML = `
        <div class="absolute -top-6 w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-b-[20px] border-b-[#2F6FEB]/40"></div>
        <div class="w-7 h-7 rounded-full bg-[#2F6FEB]/25 animate-ping absolute"></div>
        <div class="w-5 h-5 rounded-full bg-[#2F6FEB] border-2 border-white shadow-md flex items-center justify-center">
          <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
        </div>
        <div class="absolute -bottom-4 px-1.5 py-0.2 text-[9px] font-mono tracking-tight bg-black/75 text-white rounded whitespace-nowrap">
          Simulated GPS
        </div>
      `;
      const gpsMarker = new maplibregl.Marker({ element: gpsEl })
        .setLngLat([effectiveCenter.longitude, effectiveCenter.latitude])
        .addTo(map);
      markersRef.current.push(gpsMarker);

      // 2. POI Markers (if layer enabled)
      if (layers.pointsOfInterest) {
        places.forEach((place) => {
          const isSelected = selectedPlace?.id === place.id;
          const el = document.createElement('div');
          el.className = `p-1.5 rounded-full shadow-md border cursor-pointer transition-transform hover:scale-110 ${
            isSelected
              ? 'bg-[#2F6FEB] border-white text-white scale-125 z-20'
              : 'bg-[#1E1E1E] border-neutral-600 text-neutral-200'
          }`;
          el.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          `;
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            setSelectedPlace(place);
            setTemporaryPin(null);
            if (onSelectPlace) onSelectPlace(place);
          });

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([place.longitude, place.latitude])
            .addTo(map);
          markersRef.current.push(marker);
        });
      }

      // 3. Saved Places Markers (if layer enabled)
      if (layers.savedPlaces) {
        savedPlaces.forEach((sp) => {
          const el = document.createElement('div');
          el.className =
            'p-1.5 rounded-full bg-emerald-600 border border-white text-white shadow-md cursor-pointer hover:scale-110 transition-transform';
          el.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
            </svg>
          `;
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            setTemporaryPin({ latitude: sp.latitude, longitude: sp.longitude, title: sp.name });
            setSelectedPlace(null);
          });

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([sp.longitude, sp.latitude])
            .addTo(map);
          markersRef.current.push(marker);
        });
      }

      // 4. Road Alerts & Camera Markers (if layer enabled)
      if (layers.speedCameras) {
        roadAlerts.forEach((alert) => {
          if (!enabledAlertCategories[alert.category]) return;

          const isCam = alert.category.includes('camera') || alert.category.includes('zone');
          const el = document.createElement('div');
          el.className = `p-1 rounded-full border shadow-md cursor-pointer ${
            isCam
              ? 'bg-[#C9973F] border-white text-black'
              : 'bg-[#B4413A] border-white text-white'
          }`;
          el.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M12 9v4"/><path d="M12 17h.01"/><path d="M3.6 15h16.8L12 3 3.6 15z"/>
            </svg>
          `;
          el.title = `${alert.roadName}: ${alert.description}`;

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([alert.longitude, alert.latitude])
            .addTo(map);
          markersRef.current.push(marker);
        });
      }

      // 5. Temporary Dropped Pin
      if (temporaryPin) {
        const pinEl = document.createElement('div');
        pinEl.className = 'text-red-500 drop-shadow-lg cursor-pointer transform -translate-y-4';
        pinEl.innerHTML = `
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#EF4444" stroke="#FFFFFF" stroke-width="1.5">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5" fill="#FFFFFF"/>
          </svg>
        `;
        const pinMarker = new maplibregl.Marker({ element: pinEl })
          .setLngLat([temporaryPin.longitude, temporaryPin.latitude])
          .addTo(map);
        markersRef.current.push(pinMarker);
      }
    } catch {
      // ignore
    }
  }, [
    effectiveCenter,
    layers,
    places,
    savedPlaces,
    roadAlerts,
    enabledAlertCategories,
    selectedPlace,
    temporaryPin,
    onSelectPlace,
    setSelectedPlace,
    setTemporaryPin,
    hasInitError,
  ]);

  // Update markers when state changes
  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  // Draw active route polyline on MapLibre
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isStyleLoaded || !activeRouteCoordinates || hasInitError) return;

    try {
      const sourceId = 'active-route-source';
      const layerId = 'active-route-layer';

      const geojsonData: any = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: activeRouteCoordinates,
        },
      };

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojsonData);
      } else {
        map.addSource(sourceId, {
          type: 'geojson',
          data: geojsonData,
        });

        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': theme === 'dark' ? '#3B82F6' : '#2F6FEB',
            'line-width': 5,
            'line-opacity': 0.9,
          },
        });
      }

      // Fit bounds to route
      if (activeRouteCoordinates.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        activeRouteCoordinates.forEach((coord) => bounds.extend(coord));
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 });
      }

      return () => {
        try {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        } catch {}
      };
    } catch {}
  }, [activeRouteCoordinates, isStyleLoaded, theme, hasInitError]);

  // Fallback to SVG Map if MapLibre fails or offline mode is toggled
  if (hasInitError || airplaneOfflineMode) {
    return (
      <FallbackMap
        onTapLocation={(c) => {
          setTemporaryPin(c);
          setSelectedPlace(null);
          if (onTapLocation) onTapLocation(c);
        }}
        onSelectPlace={(p) => {
          setSelectedPlace(p);
          setTemporaryPin(null);
          if (onSelectPlace) onSelectPlace(p);
        }}
        temporaryPin={temporaryPin}
        savedPlaces={savedPlaces}
        alerts={roadAlerts.filter((a) => enabledAlertCategories[a.category])}
        routeCoordinates={activeRouteCoordinates}
        styleNotice={styleNotice || undefined}
        onRetryRealMap={() => {
          setHasInitError(false);
          setStyleNotice(null);
        }}
      />
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* MapLibre WebGL Container */}
      <div ref={mapContainerRef} className="w-full h-full bg-[#181818]" />

      {/* Subtle indicator if low-detail fallback style is loaded or slow network */}
      {styleNotice && (
        <div className="absolute top-14 left-3 bg-black/85 text-neutral-300 text-[10px] px-2.5 py-1 rounded-lg border border-neutral-700 shadow-sm flex items-center gap-2 z-20">
          <span>{styleNotice}</span>
          <button
            onClick={() => setHasInitError(true)}
            className="text-[#2F6FEB] underline hover:text-[#3B82F6]"
          >
            Switch to SVG Map
          </button>
        </div>
      )}
    </div>
  );
};
