import React, { useState, useRef, useCallback } from 'react';
import { Plus, Minus, RotateCcw, Compass } from 'lucide-react';
import { Place, RoadAlert, SavedPlace, TemporaryPin } from '../../types';

interface FallbackMapProps {
  onTapLocation: (coords: { latitude: number; longitude: number }) => void;
  onSelectPlace: (place: Place | null) => void;
  temporaryPin: TemporaryPin | null;
  savedPlaces: SavedPlace[];
  alerts: RoadAlert[];
  routeCoordinates?: [number, number][]; // [lng, lat]
  styleNotice?: string;
  onRetryRealMap?: () => void;
}

export const FallbackMap: React.FC<FallbackMapProps> = ({
  onTapLocation,
  onSelectPlace,
  temporaryPin,
  savedPlaces,
  alerts,
  routeCoordinates,
  styleNotice,
  onRetryRealMap,
}) => {
  // Kutaisi center approx: lng 42.6946, lat 42.2679
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch handling for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && e.touches[0]) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1 || !e.touches[0]) return;
    setPan({
      x: e.touches[0].clientX - dragStartRef.current.x,
      y: e.touches[0].clientY - dragStartRef.current.y,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  // Map coordinate conversion to SVG canvas
  // Kutaisi bounding box approx:
  // Center: lng 42.7000, lat 42.2680
  const centerLng = 42.7000;
  const centerLat = 42.2680;
  const scale = 8000 * zoom;

  const toSvgX = useCallback(
    (lng: number) => 200 + (lng - centerLng) * scale + pan.x,
    [centerLng, scale, pan.x]
  );
  const toSvgY = useCallback(
    (lat: number) => 300 - (lat - centerLat) * scale * 1.35 + pan.y,
    [centerLat, scale, pan.y]
  );

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left - pan.x - 200;
    const clickY = e.clientY - rect.top - pan.y - 300;

    const clickLng = centerLng + clickX / scale;
    const clickLat = centerLat - clickY / (scale * 1.35);

    onTapLocation({
      latitude: parseFloat(clickLat.toFixed(5)),
      longitude: parseFloat(clickLng.toFixed(5)),
    });
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Convert route coordinates to SVG points
  const routePointsStr = routeCoordinates
    ? routeCoordinates.map((pt) => `${toSvgX(pt[0])},${toSvgY(pt[1])}`).join(' ')
    : '';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#1A1A1A] select-none overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* SVG Canvas Map */}
      <svg
        className="w-full h-full"
        onClick={handleSvgClick}
        style={{ touchAction: 'none' }}
      >
        <defs>
          <linearGradient id="riverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.8" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background Grid Pattern */}
        <g stroke="#262626" strokeWidth="0.5">
          {Array.from({ length: 20 }).map((_, i) => (
            <React.Fragment key={i}>
              <line x1={-400 + i * 80 + (pan.x % 80)} y1="-200" x2={-400 + i * 80 + (pan.x % 80)} y2="900" />
              <line x1="-200" y1={-400 + i * 80 + (pan.y % 80)} x2="700" y2={-400 + i * 80 + (pan.y % 80)} />
            </React.Fragment>
          ))}
        </g>

        {/* Ukimerioni Hill Area */}
        <ellipse
          cx={toSvgX(42.7042)}
          cy={toSvgY(42.2772)}
          rx={65 * zoom}
          ry={45 * zoom}
          fill="#1E2A20"
          stroke="#2A3D2D"
          strokeWidth="1"
        />
        <text
          x={toSvgX(42.7042)}
          y={toSvgY(42.2772) + 25 * zoom}
          fill="#4ADE80"
          fontSize={9 * Math.max(0.8, zoom)}
          opacity="0.6"
          textAnchor="middle"
          fontWeight="500"
        >
          Ukimerioni Hill
        </text>

        {/* Rioni River Curving Path */}
        <path
          d={`M ${toSvgX(42.72)} ${toSvgY(42.285)} Q ${toSvgX(42.705)} ${toSvgY(42.275)} ${toSvgX(42.698)} ${toSvgY(42.270)} T ${toSvgX(42.690)} ${toSvgY(42.260)} T ${toSvgX(42.670)} ${toSvgY(42.250)}`}
          fill="none"
          stroke="url(#riverGrad)"
          strokeWidth={14 * zoom}
          strokeLinecap="round"
        />
        <text
          x={toSvgX(42.696)}
          y={toSvgY(42.267)}
          fill="#60A5FA"
          fontSize={10 * Math.max(0.8, zoom)}
          fontStyle="italic"
          opacity="0.75"
        >
          Rioni River (რიონი)
        </text>

        {/* Major Roads in Kutaisi */}
        {/* Rustaveli Avenue */}
        <line
          x1={toSvgX(42.685)}
          y1={toSvgY(42.265)}
          x2={toSvgX(42.715)}
          y2={toSvgY(42.271)}
          stroke="#383838"
          strokeWidth={7 * zoom}
          strokeLinecap="round"
        />
        <text
          x={toSvgX(42.700)}
          y={toSvgY(42.269) - 6 * zoom}
          fill="#888888"
          fontSize={8 * Math.max(0.8, zoom)}
          textAnchor="middle"
        >
          Rustaveli Ave
        </text>

        {/* Chavchavadze Avenue */}
        <line
          x1={toSvgX(42.675)}
          y1={toSvgY(42.258)}
          x2={toSvgX(42.705)}
          y2={toSvgY(42.264)}
          stroke="#383838"
          strokeWidth={6 * zoom}
          strokeLinecap="round"
        />

        {/* Tamar Mepe Street */}
        <line
          x1={toSvgX(42.700)}
          y1={toSvgY(42.260)}
          x2={toSvgX(42.702)}
          y2={toSvgY(42.280)}
          stroke="#383838"
          strokeWidth={5 * zoom}
          strokeLinecap="round"
        />

        {/* White Bridge Bridge Connection */}
        <line
          x1={toSvgX(42.697)}
          y1={toSvgY(42.271)}
          x2={toSvgX(42.699)}
          y2={toSvgY(42.269)}
          stroke="#FFFFFF"
          strokeWidth={3 * zoom}
          strokeDasharray="2,2"
        />

        {/* Active Route Polyline if available */}
        {routePointsStr && (
          <polyline
            points={routePointsStr}
            fill="none"
            stroke="#2F6FEB"
            strokeWidth={5 * zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />
        )}

        {/* Seeded Place Markers */}
        <g>
          {/* Colchis Fountain */}
          <g
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onSelectPlace({
                id: 'colchis-fountain',
                name: 'Colchis Fountain',
                nameKa: 'კოლხური შადრევანი',
                category: 'attractions',
                latitude: 42.2679,
                longitude: 42.7001,
                description: 'Central square monument with Colchian jewelry replicas.',
                descriptionKa: 'ცენტრალური მოედნის მონუმენტი.',
                aliases: [],
                demo: true,
              });
            }}
          >
            <circle
              cx={toSvgX(42.7001)}
              cy={toSvgY(42.2679)}
              r={7 * zoom}
              fill="#C9973F"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            <text
              x={toSvgX(42.7001)}
              y={toSvgY(42.2679) - 10 * zoom}
              fill="#FFFFFF"
              fontSize={10 * Math.max(0.8, zoom)}
              fontWeight="600"
              textAnchor="middle"
            >
              Colchis Fountain
            </text>
          </g>

          {/* Bagrati Cathedral */}
          <g
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onSelectPlace({
                id: 'bagrati-cathedral',
                name: 'Bagrati Cathedral',
                nameKa: 'ბაგრატის ტაძარი',
                category: 'attractions',
                latitude: 42.2772,
                longitude: 42.7042,
                description: '11th-century cathedral overlooking Kutaisi.',
                descriptionKa: 'XI საუკუნის ტაძარი.',
                aliases: [],
                demo: true,
              });
            }}
          >
            <circle
              cx={toSvgX(42.7042)}
              cy={toSvgY(42.2772)}
              r={7 * zoom}
              fill="#2F6FEB"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            <text
              x={toSvgX(42.7042)}
              y={toSvgY(42.2772) - 10 * zoom}
              fill="#FFFFFF"
              fontSize={10 * Math.max(0.8, zoom)}
              fontWeight="600"
              textAnchor="middle"
            >
              Bagrati Cathedral
            </text>
          </g>
        </g>

        {/* Road Alert Markers */}
        {alerts.map((alert) => (
          <g key={alert.id}>
            <circle
              cx={toSvgX(alert.longitude)}
              cy={toSvgY(alert.latitude)}
              r={6 * zoom}
              fill={alert.category.includes('camera') ? '#C9973F' : '#B4413A'}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          </g>
        ))}

        {/* Saved Places Markers */}
        {savedPlaces.map((sp) => (
          <g key={sp.id}>
            <polygon
              points={`${toSvgX(sp.longitude)},${toSvgY(sp.latitude) - 8 * zoom} ${toSvgX(sp.longitude) - 5 * zoom},${toSvgY(sp.latitude) + 4 * zoom} ${toSvgX(sp.longitude) + 5 * zoom},${toSvgY(sp.latitude) + 4 * zoom}`}
              fill="#10B981"
              stroke="#FFFFFF"
              strokeWidth="1"
            />
          </g>
        ))}

        {/* Temporary Dropped Pin */}
        {temporaryPin && (
          <g>
            <circle
              cx={toSvgX(temporaryPin.longitude)}
              cy={toSvgY(temporaryPin.latitude)}
              r={8 * zoom}
              fill="#EF4444"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            <line
              x1={toSvgX(temporaryPin.longitude)}
              y1={toSvgY(temporaryPin.latitude)}
              x2={toSvgX(temporaryPin.longitude)}
              y2={toSvgY(temporaryPin.latitude) + 12 * zoom}
              stroke="#EF4444"
              strokeWidth="3"
            />
          </g>
        )}

        {/* Schematic centre marker (this fallback map is not GPS driven) */}
        <g>
          <circle
            cx={toSvgX(42.6946)}
            cy={toSvgY(42.2679)}
            r={5 * zoom}
            fill="#2F6FEB"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
        </g>
      </svg>

      {/* Top Banner Notice: Offline Demo Map */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto bg-[#181818]/90 text-neutral-300 text-[11px] px-2.5 py-1.5 rounded-lg border border-neutral-700/80 shadow-md backdrop-blur-md flex items-center gap-1.5">
          <Compass size={13} className="text-[#C9973F]" />
          <span className="font-medium">Offline demo map</span>
          <span className="text-neutral-500">·</span>
          <span className="text-neutral-400">Kutaisi streets & river</span>
        </div>

        {onRetryRealMap && (
          <button
            onClick={onRetryRealMap}
            className="pointer-events-auto bg-[#2F6FEB] hover:bg-[#2563EB] text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-md transition-colors"
          >
            Retry Vector Map
          </button>
        )}
      </div>

      {styleNotice && (
        <div className="absolute top-12 left-3 bg-[#181818]/90 text-neutral-400 text-[10px] px-2 py-0.5 rounded border border-neutral-700">
          {styleNotice}
        </div>
      )}

      {/* Fallback Map Controls (Zoom in/out, Recenter) */}
      <div className="absolute bottom-20 left-3 flex flex-col gap-1.5 z-20">
        <button
          onClick={() => setZoom((z) => Math.min(3, z + 0.3))}
          className="w-8 h-8 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] text-white flex items-center justify-center border border-neutral-700 shadow-sm"
          aria-label="Zoom in"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.3))}
          className="w-8 h-8 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] text-white flex items-center justify-center border border-neutral-700 shadow-sm"
          aria-label="Zoom out"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={resetView}
          className="w-8 h-8 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] text-white flex items-center justify-center border border-neutral-700 shadow-sm"
          aria-label="Reset orientation"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Tap hint at bottom */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-neutral-500 bg-black/60 px-2 py-0.5 rounded pointer-events-none">
        Drag to pan · Tap to drop pin · Kutaisi (42.2679, 42.6946)
      </div>
    </div>
  );
};
