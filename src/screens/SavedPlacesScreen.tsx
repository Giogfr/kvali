import React, { useState, useRef } from 'react';
import {
  Bookmark,
  FolderPlus,
  Download,
  Upload,
  Navigation,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HeaderBar } from '../components/common/HeaderBar';
import { useToast } from '../context/ToastContext';
import { SavedPlace } from '../types';

export const SavedPlacesScreen: React.FC = () => {
  const {
    t,
    theme,
    navigateTo,
    savedPlaces,
    collections,
    createCollection,
    deleteSavedPlace,
    updateSavedPlace,
    importPlacesJson,
    setRouteDestination,
    setSelectedPlace,
    setTemporaryPin,
  } = useApp();

  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeCollection, setActiveCollection] = useState<string>('All');
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editCollection, setEditCollection] = useState('');

  const displayedPlaces = savedPlaces.filter((p) => {
    if (activeCollection === 'All') return true;
    return p.collection === activeCollection;
  });

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return;
    createCollection(newCollectionName.trim());
    showToast(`Collection "${newCollectionName.trim()}" created`, 'success');
    setNewCollectionName('');
    setShowNewCollectionModal(false);
  };

  const startEdit = (place: SavedPlace) => {
    setEditingPlace(place);
    setEditName(place.name);
    setEditNote(place.note || '');
    setEditCollection(place.collection);
  };

  const saveEdit = () => {
    if (!editingPlace) return;
    updateSavedPlace(editingPlace.id, {
      name: editName.trim() || editingPlace.name,
      note: editNote.trim(),
      collection: editCollection,
    });
    showToast(t('saveChanges'), 'success');
    setEditingPlace(null);
  };

  const handleNavigateToPlace = (place: SavedPlace) => {
    setTemporaryPin({
      latitude: place.latitude,
      longitude: place.longitude,
      title: place.name,
    });
    setSelectedPlace(null);
    navigateTo('map');
  };

  const handleDirections = (place: SavedPlace) => {
    setRouteDestination({
      title: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    navigateTo('route-planning');
  };

  const handleExportBackup = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(savedPlaces, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `kvali_saved_places_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast(t('backupSuccess'), 'success');
    } catch {
      showToast('Export failed', 'warn');
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importPlacesJson(content);
      if (success) {
        showToast(t('importSuccess'), 'success');
      } else {
        showToast('Invalid backup file format', 'warn');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className={`w-full h-full flex flex-col transition-colors ${
        theme === 'dark' ? 'bg-[#141414] text-white' : 'bg-[#F7F7F5] text-[#111111]'
      }`}
    >
      <HeaderBar
        title={t('savedPlacesTitle')}
        onBack={() => navigateTo('map')}
        rightAction={
          <div className="flex items-center gap-1">
            <button
              onClick={handleExportBackup}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white transition-colors"
              title={t('exportBackup')}
              aria-label={t('exportBackup')}
            >
              <Download size={17} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white transition-colors"
              title={t('importBackup')}
              aria-label={t('importBackup')}
            >
              <Upload size={17} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.gpx"
              className="hidden"
              onChange={handleFileImport}
            />
          </div>
        }
      />

      {/* Collections Horizontal Tabs */}
      <div className="p-3 border-b border-neutral-800/60 bg-neutral-900/30">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setActiveCollection('All')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium shrink-0 border transition-all ${
              activeCollection === 'All'
                ? 'bg-[#2F6FEB] border-[#2F6FEB] text-white'
                : 'bg-neutral-800/80 border-neutral-700 text-neutral-300'
            }`}
          >
            {t('allSaved')} ({savedPlaces.length})
          </button>

          {collections.map((col) => {
            const count = savedPlaces.filter((p) => p.collection === col).length;
            const isSelected = activeCollection === col;

            return (
              <button
                key={col}
                onClick={() => setActiveCollection(col)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium shrink-0 border transition-all ${
                  isSelected
                    ? 'bg-[#2F6FEB] border-[#2F6FEB] text-white'
                    : 'bg-neutral-800/80 border-neutral-700 text-neutral-300'
                }`}
              >
                {col} ({count})
              </button>
            );
          })}

          <button
            onClick={() => setShowNewCollectionModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium shrink-0 border border-dashed border-neutral-600 text-neutral-400 hover:text-white"
          >
            <FolderPlus size={12} />
            <span>+</span>
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
        {displayedPlaces.length > 0 ? (
          displayedPlaces.map((place) => (
            <div
              key={place.id}
              className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div
                  className="min-w-0 flex-1 cursor-pointer pr-2"
                  onClick={() => handleNavigateToPlace(place)}
                >
                  <div className="flex items-center gap-2">
                    <Bookmark size={14} className="text-[#2F6FEB] shrink-0 fill-current" />
                    <span className="text-[13px] font-semibold truncate text-neutral-100">
                      {place.name}
                    </span>
                  </div>

                  <p className="text-[10px] text-neutral-400 font-mono mt-0.5 ml-5">
                    {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)} · {place.collection}
                  </p>

                  {place.note && (
                    <p className="text-[11px] text-neutral-400 italic mt-1 ml-5 line-clamp-2">
                      "{place.note}"
                    </p>
                  )}
                </div>

                {/* Place Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleDirections(place)}
                    className="p-2 rounded-lg bg-[#2F6FEB]/15 hover:bg-[#2F6FEB]/25 text-[#2F6FEB] transition-colors"
                    title={t('directions')}
                  >
                    <Navigation size={14} />
                  </button>
                  <button
                    onClick={() => startEdit(place)}
                    className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => {
                      deleteSavedPlace(place.id);
                      showToast('Place deleted', 'info');
                    }}
                    className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-red-400 transition-colors"
                    title={t('deletePlace')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-16 text-center text-neutral-500">
            <Bookmark size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-[13px] font-medium">{t('noSavedPlaces')}</p>
            <p className="text-[11px] mt-1 text-neutral-600">
              Tap any location or POI on the map to bookmark it.
            </p>
          </div>
        )}
      </div>

      {/* Edit Place Sheet / Modal */}
      {editingPlace && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-[#1E1E1E] p-4 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-700">
              <h3 className="text-[15px] font-semibold">{t('editPlace')}</h3>
              <button
                onClick={() => setEditingPlace(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 mt-3">
              <div>
                <label className="text-[11px] text-neutral-400 font-medium uppercase tracking-wider block mb-1">
                  {t('placeName')}
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-neutral-700 bg-neutral-800 text-white focus:outline-none focus:border-[#2F6FEB]"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 font-medium uppercase tracking-wider block mb-1">
                  {t('notes')}
                </label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-[12px] rounded-lg border border-neutral-700 bg-neutral-800 text-white focus:outline-none focus:border-[#2F6FEB]"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 font-medium uppercase tracking-wider block mb-1">
                  {t('collections')}
                </label>
                <select
                  value={editCollection}
                  onChange={(e) => setEditCollection(e.target.value)}
                  className="w-full px-3 py-2 text-[12px] rounded-lg border border-neutral-700 bg-neutral-800 text-white focus:outline-none focus:border-[#2F6FEB]"
                >
                  {collections.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-neutral-700">
              <button
                onClick={() => setEditingPlace(null)}
                className="px-3 py-1.5 text-[12px] text-neutral-400 hover:text-white"
              >
                {t('cancel')}
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-1.5 text-[12px] font-semibold bg-[#2F6FEB] hover:bg-[#2563EB] text-white rounded-lg shadow"
              >
                {t('saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Collection Modal */}
      {showNewCollectionModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-[#1E1E1E] p-4 shadow-2xl text-white">
            <h3 className="text-[15px] font-semibold mb-2">{t('newCollection')}</h3>
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder={t('collectionNamePlaceholder')}
              className="w-full px-3 py-2 text-[13px] rounded-lg border border-neutral-700 bg-neutral-800 text-white focus:outline-none focus:border-[#2F6FEB]"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setShowNewCollectionModal(false)}
                className="px-3 py-1.5 text-[12px] text-neutral-400 hover:text-white"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleCreateCollection}
                className="px-4 py-1.5 text-[12px] font-semibold bg-[#2F6FEB] hover:bg-[#2563EB] text-white rounded-lg shadow"
              >
                {t('createCollection')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
