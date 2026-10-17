import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  X,
  Clock,
  Fuel,
  SquareParking,
  Utensils,
  Hotel,
  Hospital,
  Banknote,
  Zap,
  Eye,
  Pill,
  ShoppingBag,
  Landmark,
  Footprints,
  ChevronRight,
  Navigation,
  Globe,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HeaderBar } from '../components/common/HeaderBar';
import { DemoChip } from '../components/common/Controls';
import { calculateDistanceKm, formatDistance } from '../lib/geo';
import { searchNominatim, type GeocodeResult } from '../lib/services';
import { Place, PlaceCategory } from '../types';

export const SearchScreen: React.FC = () => {
  const {
    t,
    language,
    theme,
    units,
    places,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    setSelectedPlace,
    setTemporaryPin,
    navigateTo,
    effectiveCenter,
    setRouteDestination,
  } = useApp();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory | null>(null);

  const categoryShortcuts: { id: PlaceCategory; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { id: 'fuel', label: t('cat_fuel'), icon: Fuel },
    { id: 'parking', label: t('cat_parking'), icon: SquareParking },
    { id: 'food', label: t('cat_food'), icon: Utensils },
    { id: 'hotels', label: t('cat_hotels'), icon: Hotel },
    { id: 'hospital', label: t('cat_hospital'), icon: Hospital },
    { id: 'atm', label: t('cat_atm'), icon: Banknote },
    { id: 'ev_charging', label: t('cat_ev_charging'), icon: Zap },
    { id: 'viewpoints', label: t('cat_viewpoints'), icon: Eye },
    { id: 'pharmacies', label: t('cat_pharmacies'), icon: Pill },
    { id: 'groceries', label: t('cat_groceries'), icon: ShoppingBag },
    { id: 'attractions', label: t('cat_attractions'), icon: Landmark },
    { id: 'hiking', label: t('cat_hiking'), icon: Footprints },
  ];

  // Live filter over the bundled catalog
  const filteredPlaces = useMemo(() => {
    let list = places;

    if (selectedCategory) {
      list = list.filter((p) => p.category === selectedCategory);
    }

    if (!query.trim()) {
      return selectedCategory ? list : [];
    }

    const q = query.toLowerCase().trim();
    return list.filter((p) => {
      const matchNameEn = p.name.toLowerCase().includes(q);
      const matchNameKa = p.nameKa.toLowerCase().includes(q);
      const matchDesc = p.description.toLowerCase().includes(q) || p.descriptionKa.toLowerCase().includes(q);
      const matchAliases = p.aliases.some((a) => a.toLowerCase().includes(q));
      const matchCategory = p.category.toLowerCase().includes(q);
      return matchNameEn || matchNameKa || matchDesc || matchAliases || matchCategory;
    });
  }, [places, query, selectedCategory]);

  // Search OpenStreetMap (Nominatim) for places beyond the bundled catalog
  const [remoteResults, setRemoteResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setRemoteResults([]);
      setIsSearching(false);
      setSearchFailed(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchFailed(false);
      try {
        const results = await searchNominatim(q, effectiveCenter, controller.signal);
        setRemoteResults(results);
      } catch {
        if (!controller.signal.aborted) {
          setRemoteResults([]);
          setSearchFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, effectiveCenter]);

  const handleSelectPlace = (place: Place) => {
    addRecentSearch(place.name);
    setSelectedPlace(place);
    setTemporaryPin(null);
    navigateTo('map');
  };

  const handleDirectionsDirect = (e: React.MouseEvent, place: Place) => {
    e.stopPropagation();
    addRecentSearch(place.name);
    setSelectedPlace(place);
    setRouteDestination(place);
    navigateTo('route-planning');
  };

  const handleSelectResult = (result: GeocodeResult) => {
    addRecentSearch(result.name);
    setTemporaryPin({
      latitude: result.latitude,
      longitude: result.longitude,
      title: result.name,
      address: result.displayName,
    });
    setSelectedPlace(null);
    navigateTo('map');
  };

  const handleDirectionsResult = (e: React.MouseEvent, result: GeocodeResult) => {
    e.stopPropagation();
    addRecentSearch(result.name);
    const pin = {
      latitude: result.latitude,
      longitude: result.longitude,
      title: result.name,
      address: result.displayName,
    };
    setTemporaryPin(pin);
    setSelectedPlace(null);
    setRouteDestination(pin);
    navigateTo('route-planning');
  };

  const hasQuery = query.trim().length > 0 || selectedCategory !== null;
  const nothingFound =
    filteredPlaces.length === 0 && remoteResults.length === 0 && !isSearching && query.trim().length >= 3;

  return (
    <div
      className={`w-full h-full flex flex-col transition-colors ${
        theme === 'dark' ? 'bg-[#141414] text-white' : 'bg-[#F7F7F5] text-[#111111]'
      }`}
    >
      <HeaderBar title={t('searchTitle')} onBack={() => navigateTo('map')} />

      {/* Search Input Box */}
      <div className="p-3 border-b border-neutral-800/40">
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
            theme === 'dark'
              ? 'bg-[#1F1F1F] border-neutral-700 text-white'
              : 'bg-white border-neutral-300 text-[#111111]'
          } focus-within:border-[#2F6FEB]`}
        >
          <Search size={18} className="text-neutral-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full text-[13px] bg-transparent focus:outline-none"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-neutral-400 hover:text-white"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Horizontal Category Carousel Shortcuts */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mt-2.5 py-1">
          {categoryShortcuts.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(isSelected ? null : cat.id);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium shrink-0 border transition-all ${
                  isSelected
                    ? 'bg-[#2F6FEB] border-[#2F6FEB] text-white'
                    : theme === 'dark'
                    ? 'bg-[#1C1C1C] border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300'
                }`}
              >
                <Icon size={13} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Search Body */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {hasQuery ? (
          <>
            {/* Bundled catalog matches */}
            {filteredPlaces.length > 0 && (
              <div>
                <div className="flex items-center justify-between py-1 text-[11px] text-neutral-500 font-medium">
                  <span>{filteredPlaces.length} locations found</span>
                  <span className="text-[10px]">{t('demoCatalogNote')}</span>
                </div>
                <div className="divide-y divide-neutral-800/40">
                  {filteredPlaces.map((place) => {
                    const distKm = calculateDistanceKm(
                      effectiveCenter.latitude,
                      effectiveCenter.longitude,
                      place.latitude,
                      place.longitude
                    );
                    const distStr = formatDistance(distKm, units);

                    return (
                      <div
                        key={place.id}
                        onClick={() => handleSelectPlace(place)}
                        className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-neutral-800/30 cursor-pointer transition-colors group"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold truncate">
                              {language === 'ka' ? place.nameKa : place.name}
                            </span>
                            <DemoChip label={t('demoData')} />
                          </div>
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {language === 'ka' ? place.descriptionKa : place.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-500">
                            <span className="capitalize">{place.category}</span>
                            <span>·</span>
                            <span className="tabular-nums font-mono text-[#2F6FEB]">
                              ~{distStr}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={(e) => handleDirectionsDirect(e, place)}
                            className="p-2 rounded-lg bg-[#2F6FEB]/10 hover:bg-[#2F6FEB]/20 text-[#2F6FEB] transition-colors"
                            title={t('directions')}
                            aria-label={t('directions')}
                          >
                            <Navigation size={15} />
                          </button>
                          <ChevronRight size={16} className="text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* OpenStreetMap results */}
            {query.trim().length >= 3 && (
              <div>
                <div className="flex items-center justify-between py-1 text-[11px] text-neutral-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Globe size={13} />
                    <span>OpenStreetMap</span>
                  </div>
                  {isSearching && <span className="text-[10px]">{t('searching')}</span>}
                </div>

                {searchFailed && !isSearching && (
                  <div className="text-[12px] text-neutral-500 py-2">{t('searchUnavailable')}</div>
                )}

                <div className="divide-y divide-neutral-800/40">
                  {remoteResults.map((result) => {
                    const distKm = calculateDistanceKm(
                      effectiveCenter.latitude,
                      effectiveCenter.longitude,
                      result.latitude,
                      result.longitude
                    );
                    const distStr = formatDistance(distKm, units);

                    return (
                      <div
                        key={result.id}
                        onClick={() => handleSelectResult(result)}
                        className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-neutral-800/30 cursor-pointer transition-colors group"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="text-[13px] font-semibold truncate block">
                            {result.name}
                          </span>
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {result.displayName}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-500">
                            {result.category && (
                              <>
                                <span className="capitalize">{result.category.replace(/_/g, ' ')}</span>
                                <span>·</span>
                              </>
                            )}
                            <span className="tabular-nums font-mono text-[#2F6FEB]">~{distStr}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={(e) => handleDirectionsResult(e, result)}
                            className="p-2 rounded-lg bg-[#2F6FEB]/10 hover:bg-[#2F6FEB]/20 text-[#2F6FEB] transition-colors"
                            title={t('directions')}
                            aria-label={t('directions')}
                          >
                            <Navigation size={15} />
                          </button>
                          <ChevronRight size={16} className="text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Nothing came back */}
            {nothingFound && (
              <div className="py-12 text-center text-neutral-400">
                <Search size={32} className="mx-auto mb-2 opacity-30" />
                <h4 className="text-[14px] font-semibold">{t('noResultsFound')}</h4>
                <p className="text-[12px] text-neutral-500 mt-1 max-w-[240px] mx-auto">
                  {t('tryAnotherSearch')}
                </p>
              </div>
            )}
          </>
        ) : (
          /* Recent Searches & Suggested Places */
          <div>
            {recentSearches.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between py-1 mb-1">
                  <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
                    {t('recentSearches')}
                  </span>
                  <button
                    onClick={clearRecentSearches}
                    className="text-[11px] text-neutral-500 hover:text-neutral-300"
                  >
                    {t('clearAll')}
                  </button>
                </div>
                <div className="space-y-1">
                  {recentSearches.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setQuery(item)}
                      className="w-full flex items-center justify-between py-2 px-2.5 rounded-lg text-left text-[12px] text-neutral-300 hover:bg-neutral-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Clock size={13} className="text-neutral-500" />
                        <span>{item}</span>
                      </div>
                      <ChevronRight size={14} className="text-neutral-600" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Georgian Landmarks */}
            <div>
              <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
                Popular in Georgia
              </span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {places.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPlace(p)}
                    className="p-2.5 rounded-xl border border-neutral-800/80 bg-neutral-900/40 hover:bg-neutral-800/60 text-left transition-colors"
                  >
                    <span className="text-[12px] font-medium block truncate">
                      {language === 'ka' ? p.nameKa : p.name}
                    </span>
                    <span className="text-[10px] text-neutral-500 capitalize block truncate mt-0.5">
                      {p.category}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
