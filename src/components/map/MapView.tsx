import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import maplibreglWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useApp } from '../../context/AppContext';
import { FallbackMap } from './FallbackMap';
import { MAP_STYLES } from '../../lib/offline';
import { Place } from '../../types';

// Configure MapLibre Web Worker URL via Vite asset bundler
try {
  if (typeof (maplibregl as any).setWorkerUrl === 'function' && maplibreglWorkerUrl) {
    (maplibregl as any).setWorkerUrl(maplibreglWorkerUrl);
  }
} catch (err) {
  console.warn('Could not set MapLibre workerUrl:', err);
}

const LONG_PRESS_MS = 500;

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

export interface MapViewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  toggle3D: () => void;
}

export const MapView = React.forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { onTapLocation, onSelectPlace, activeRouteCoordinates },
  ref
) {
  const {
    theme,
    effectiveCenter,
    userLocation,
    manualLocation,
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
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const gpsMarkerRef = useRef<maplibregl.Marker | null>(null);
  const manualMarkerRef = useRef<maplibregl.Marker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const pressTimerRef = useRef<number | null>(null);
  const appliedStyleRef = useRef<string | null>(null);
  const onSelectPlaceRef = useRef(onSelectPlace);
  const onTapLocationRef = useRef(onTapLocation);
  const centerRef = useRef(effectiveCenter);

  onSelectPlaceRef.current = onSelectPlace;
  onTapLocationRef.current = onTapLocation;
  centerRef.current = effectiveCenter;

  React.useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        try {
          mapInstanceRef.current?.zoomIn({ duration: 250 });
        } catch {}
      },
      zoomOut: () => {
        try {
          mapInstanceRef.current?.zoomOut({ duration: 250 });
        } catch {}
      },
      toggle3D: () => {
        const map = mapInstanceRef.current;
        if (!map) return;
        try {
          const pitched = map.getPitch() > 10;
          map.easeTo({ pitch: pitched ? 0 : 55, duration: 500 });
        } catch {}
      },
    }),
    []
  );

  const [hasInitError, setHasInitError] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);

  const getTargetStyle = useCallback(() => {
    return theme === 'dark' ? MAP_STYLES.dark : MAP_STYLES.light;
  }, [theme]);

  const dropPin = useCallback(
    (lngLat: { lng: number; lat: number }) => {
      const coords = {
        latitude: parseFloat(lngLat.lat.toFixed(5)),
        longitude: parseFloat(lngLat.lng.toFixed(5)),
      };
      setTemporaryPin(coords);
      setSelectedPlace(null);
      onTapLocationRef.current?.(coords);
    },
    [setTemporaryPin, setSelectedPlace]
  );

  // Initialize MapLibre. Offline mode keeps the same map instance; cached
  // tiles are served by the service worker instead of swapping to a schematic.
  useEffect(() => {
    if (!checkWebGL()) {
      setHasInitError(true);
      return;
    }

    if (!mapContainerRef.current) return;

    let isSubscribed = true;
    const initialStyle = getTargetStyle();
    appliedStyleRef.current = initialStyle;

    const timeoutTimer = setTimeout(() => {
      if (isSubscribed && !mapInstanceRef.current?.loaded()) {
        setHasInitError(true);
      }
    }, 6000);

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: initialStyle,
        center: [effectiveCenter.longitude, effectiveCenter.latitude],
        zoom: 14,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: '© OpenStreetMap · OpenFreeMap',
        }),
        'bottom-right'
      );

      // Only downgrade to the schematic map for problems that make the map unusable.
      // Transient tile/sprite 404s and network hiccups must never kill the real map.
      map.on('error', (e: any) => {
        if (!isSubscribed) return;
        const msg = String(e?.error?.message || e?.message || (typeof e === 'string' ? e : ''));
        const isFatal =
          msg.includes('Worker failed to load') ||
          msg.includes('WebGL') ||
          msg.includes('GPU') ||
          msg.includes('WebGL context') ||
          msg.includes('context lost');
        if (isFatal) {
          console.warn('MapLibre cannot run on this device, using schematic map:', msg);
          setHasInitError(true);
        }
      });

      // Make sure every interaction is enabled (pan, wheel zoom, pinch, rotate, keyboard)
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.boxZoom.enable();
      map.doubleClickZoom.enable();
      map.keyboard.enable();
      if (map.touchZoomRotate) map.touchZoomRotate.enable();

      map.on('load', () => {
        if (!isSubscribed) return;
        setIsStyleLoaded(true);
        clearTimeout(timeoutTimer);
      });

      // Long-press drops a pin; a plain tap does nothing.
      const cancelPress = () => {
        if (pressTimerRef.current !== null) {
          clearTimeout(pressTimerRef.current);
          pressTimerRef.current = null;
        }
      };
      const startPress = (e: any) => {
        cancelPress();
        const lngLat = e?.lngLat;
        if (!lngLat) return;
        pressTimerRef.current = window.setTimeout(() => {
          pressTimerRef.current = null;
          dropPin(lngLat);
        }, LONG_PRESS_MS);
      };

      map.on('mousedown', startPress);
      map.on('touchstart', startPress);
      map.on('mouseup', cancelPress);
      map.on('touchend', cancelPress);
      map.on('touchcancel', cancelPress);
      map.on('dragstart', cancelPress);
      map.on('movestart', cancelPress);
      map.on('zoomstart', cancelPress);
      map.on('contextmenu', (e: any) => {
        if (e?.lngLat) dropPin(e.lngLat);
      });

      mapInstanceRef.current = map;

      // Keep the canvas sized to its container (sidebar toggles, orientation changes, etc.)
      if (mapContainerRef.current && typeof ResizeObserver !== 'undefined') {
        resizeObserverRef.current = new ResizeObserver(() => {
          try {
            map.resize();
          } catch {}
        });
        resizeObserverRef.current.observe(mapContainerRef.current);
      }
    } catch {
      setHasInitError(true);
    }

    return () => {
      isSubscribed = false;
      clearTimeout(timeoutTimer);
      cancelPressSafe(pressTimerRef);
      gpsMarkerRef.current = null;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap the style only when the theme actually changed (avoids a mount-time reload flash)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || hasInitError) return;
    const target = getTargetStyle();
    if (appliedStyleRef.current === target) return;
    appliedStyleRef.current = target;
    try {
      setIsStyleLoaded(false);
      map.setStyle(target);
      map.once('style.load', () => setIsStyleLoaded(true));
    } catch {}
  }, [theme, getTargetStyle, hasInitError]);

  // Recenter map animation — only when the user explicitly asks, not on every GPS fix
  useEffect(() => {
    if (!mapInstanceRef.current || recenterTrigger === 0 || hasInitError) return;
    try {
      mapInstanceRef.current.flyTo({
        center: [centerRef.current.longitude, centerRef.current.latitude],
        zoom: 14.5,
        essential: true,
        duration: 1200,
      });
    } catch {}
  }, [recenterTrigger, hasInitError]);

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

  // Render markers incrementally, reusing existing ones instead of rebuilding every time
  const updateMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || hasInitError) return;

    interface Desired {
      key: string;
      lng: number;
      lat: number;
      className: string;
      html: string;
      title?: string;
      onClick?: (e: MouseEvent) => void;
    }

    const desired: Desired[] = [];

    if (layers.pointsOfInterest) {
      places.forEach((place) => {
        const isSelected = selectedPlace?.id === place.id;
        desired.push({
          key: `poi-${place.id}`,
          lng: place.longitude,
          lat: place.latitude,
          className: `p-1.5 rounded-full shadow-md border cursor-pointer transition-transform hover:scale-110 ${
            isSelected
              ? 'bg-[#2F6FEB] border-white text-white scale-125 z-20'
              : 'bg-[#1E1E1E] border-neutral-600 text-neutral-200'
          }`,
          html: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
          onClick: (e) => {
            e.stopPropagation();
            setSelectedPlace(place);
            setTemporaryPin(null);
            onSelectPlaceRef.current?.(place);
          },
        });
      });
    }

    if (layers.savedPlaces) {
      savedPlaces.forEach((sp) => {
        desired.push({
          key: `saved-${sp.id}`,
          lng: sp.longitude,
          lat: sp.latitude,
          className:
            'p-1.5 rounded-full bg-emerald-600 border border-white text-white shadow-md cursor-pointer hover:scale-110 transition-transform',
          html: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`,
          onClick: (e) => {
            e.stopPropagation();
            setTemporaryPin({ latitude: sp.latitude, longitude: sp.longitude, title: sp.name });
            setSelectedPlace(null);
          },
        });
      });
    }

    if (layers.speedCameras) {
      roadAlerts.forEach((alert) => {
        if (!enabledAlertCategories[alert.category]) return;
        const isCam = alert.category.includes('camera') || alert.category.includes('zone');
        desired.push({
          key: `alert-${alert.id}`,
          lng: alert.longitude,
          lat: alert.latitude,
          className: `p-1 rounded-full border shadow-md cursor-pointer ${
            isCam ? 'bg-[#C9973F] border-white text-black' : 'bg-[#B4413A] border-white text-white'
          }`,
          html: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M3.6 15h16.8L12 3 3.6 15z"/></svg>`,
          title: `${alert.roadName}: ${alert.description}`,
        });
      });
    }

    if (temporaryPin) {
      desired.push({
        key: 'temp-pin',
        lng: temporaryPin.longitude,
        lat: temporaryPin.latitude,
        className: 'text-red-500 drop-shadow-lg cursor-pointer transform -translate-y-4',
        html: `<svg width="26" height="26" viewBox="0 0 24 24" fill="#EF4444" stroke="#FFFFFF" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#FFFFFF"/></svg>`,
      });
    }

    const next = new Map<string, maplibregl.Marker>();
    try {
      desired.forEach((d) => {
        const existing = markersRef.current.get(d.key);
        if (existing) {
          existing.getElement().className = d.className;
          const ll = existing.getLngLat();
          if (ll.lng !== d.lng || ll.lat !== d.lat) existing.setLngLat([d.lng, d.lat]);
          next.set(d.key, existing);
        } else {
          const el = document.createElement('div');
          el.className = d.className;
          el.innerHTML = d.html;
          if (d.title) el.title = d.title;
          if (d.onClick) el.addEventListener('click', d.onClick);
          const marker = new maplibregl.Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(map);
          next.set(d.key, marker);
        }
      });

      markersRef.current.forEach((marker, key) => {
        if (!next.has(key)) marker.remove();
      });
      markersRef.current = next;
    } catch {
      // ignore marker failures
    }
  }, [
    layers,
    places,
    savedPlaces,
    roadAlerts,
    enabledAlertCategories,
    selectedPlace,
    temporaryPin,
    setSelectedPlace,
    setTemporaryPin,
    hasInitError,
  ]);

  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  // Live location dot, updated in place on every GPS fix
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || hasInitError) {
      gpsMarkerRef.current = null;
      return;
    }

    if (!userLocation) {
      gpsMarkerRef.current?.remove();
      gpsMarkerRef.current = null;
      return;
    }

    if (!gpsMarkerRef.current) {
      const gpsEl = document.createElement('div');
      gpsEl.className = 'relative flex items-center justify-center pointer-events-none';
      gpsEl.innerHTML = `
        <div class="absolute -top-6 w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-b-[20px] border-b-[#2F6FEB]/40"></div>
        <div class="w-7 h-7 rounded-full bg-[#2F6FEB]/25 animate-ping absolute"></div>
        <div class="w-5 h-5 rounded-full bg-[#2F6FEB] border-2 border-white shadow-md flex items-center justify-center">
          <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
        </div>
      `;
      gpsMarkerRef.current = new maplibregl.Marker({ element: gpsEl })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map);
    } else {
      gpsMarkerRef.current.setLngLat([userLocation.longitude, userLocation.latitude]);
    }
  }, [userLocation, hasInitError]);

  // Manual position marker (used only when there is no live GPS fix)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || hasInitError) {
      manualMarkerRef.current = null;
      return;
    }

    if (userLocation || !manualLocation) {
      manualMarkerRef.current?.remove();
      manualMarkerRef.current = null;
      return;
    }

    if (!manualMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center pointer-events-none';
      el.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-[#C9973F]/25 absolute"></div>
        <div class="w-4 h-4 rounded-full bg-[#C9973F] border-2 border-white shadow-md"></div>
      `;
      manualMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([manualLocation.longitude, manualLocation.latitude])
        .addTo(map);
    } else {
      manualMarkerRef.current.setLngLat([manualLocation.longitude, manualLocation.latitude]);
    }
  }, [userLocation, manualLocation, hasInitError]);

  // 3D buildings (fill-extrusion from the OpenMapTiles building layer)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isStyleLoaded || hasInitError || !layers.buildings3d) {
      try {
        if (map?.getLayer('kvali-3d-buildings')) map.removeLayer('kvali-3d-buildings');
      } catch {}
      return;
    }

    const addExtrusion = () => {
      try {
        if (map.getLayer('kvali-3d-buildings')) return;
        const style = map.getStyle();
        if (!style?.layers?.some((l: any) => l['source-layer'] === 'building')) return;
        const firstSymbol = style.layers.find((l) => l.type === 'symbol');
        map.addLayer(
          {
            id: 'kvali-3d-buildings',
            type: 'fill-extrusion',
            source: 'openmaptiles',
            'source-layer': 'building',
            minzoom: 14,
            filter: ['!=', ['coalesce', ['get', 'hide_3d'], false], true],
            paint: {
              'fill-extrusion-color': theme === 'dark' ? '#34343a' : '#d8d4cd',
              'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
              'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': 0.85,
            },
          } as maplibregl.LayerSpecification,
          firstSymbol?.id
        );
        map.setMaxPitch(60);
      } catch {
        /* style may not include the building layer */
      }
    };

    addExtrusion();
    map.on('style.load', addExtrusion);
    return () => {
      try {
        map.off('style.load', addExtrusion);
      } catch {}
    };
  }, [isStyleLoaded, layers.buildings3d, theme, hasInitError]);

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
        geometry: { type: 'LineString', coordinates: activeRouteCoordinates },
      };

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojsonData);
      } else {
        map.addSource(sourceId, { type: 'geojson', data: geojsonData });
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': theme === 'dark' ? '#3B82F6' : '#2F6FEB',
            'line-width': 5,
            'line-opacity': 0.9,
          },
        });
      }
    } catch {}
  }, [activeRouteCoordinates, isStyleLoaded, theme, hasInitError]);

  // Fit the map to a newly computed route
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeRouteCoordinates || activeRouteCoordinates.length < 2) return;
    try {
      const bounds = new maplibregl.LngLatBounds();
      activeRouteCoordinates.forEach((coord) => bounds.extend(coord));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 });
    } catch {}
  }, [activeRouteCoordinates]);

  if (hasInitError) {
    return (
      <FallbackMap
        onTapLocation={(c) => {
          setTemporaryPin(c);
          setSelectedPlace(null);
          onTapLocationRef.current?.(c);
        }}
        onSelectPlace={(p) => {
          setSelectedPlace(p);
          setTemporaryPin(null);
          onSelectPlaceRef.current?.(p);
        }}
        temporaryPin={temporaryPin}
        savedPlaces={savedPlaces}
        alerts={roadAlerts.filter((a) => enabledAlertCategories[a.category])}
        routeCoordinates={activeRouteCoordinates}
      />
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full bg-[#181818]" />
    </div>
  );
});

function cancelPressSafe(ref: React.MutableRefObject<number | null>) {
  if (ref.current !== null) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}
