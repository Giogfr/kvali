import { OfflineRegion } from '../types';

const noDownloads = { status: 'not_downloaded', downloadProgress: 0, lastUpdated: '' } as const;

export const SEED_REGIONS: OfflineRegion[] = [
  {
    id: 'region-kutaisi',
    name: 'Kutaisi & Surroundings',
    nameKa: 'ქუთაისი და შემოგარენი',
    sizeMb: 42,
    bbox: [42.1, 42.1, 42.9, 42.45],
    ...noDownloads,
  },
  {
    id: 'region-imereti',
    name: 'Imereti Region',
    nameKa: 'იმერეთის რეგიონი',
    sizeMb: 118,
    bbox: [42.0, 41.9, 43.6, 42.7],
    ...noDownloads,
  },
  {
    id: 'region-tbilisi',
    name: 'Tbilisi Capital Region',
    nameKa: 'თბილისის რეგიონი',
    sizeMb: 165,
    bbox: [44.5, 41.5, 45.2, 41.9],
    ...noDownloads,
  },
  {
    id: 'region-batumi',
    name: 'Batumi & Adjara Coast',
    nameKa: 'ბათუმი და აჭარა',
    sizeMb: 86,
    bbox: [41.5, 41.4, 42.1, 41.75],
    ...noDownloads,
  },
  {
    id: 'region-svaneti',
    name: 'Svaneti Caucasus Mountains',
    nameKa: 'სვანეთი',
    sizeMb: 64,
    bbox: [42.0, 42.6, 43.4, 43.3],
    ...noDownloads,
  },
  {
    id: 'region-kakheti',
    name: 'Kakheti Wine Region',
    nameKa: 'კახეთი',
    sizeMb: 110,
    bbox: [45.2, 41.2, 46.7, 42.1],
    ...noDownloads,
  },
  {
    id: 'region-guria',
    name: 'Guria Region',
    nameKa: 'გურიის რეგიონი',
    sizeMb: 38,
    bbox: [41.9, 41.7, 42.6, 42.15],
    ...noDownloads,
  },
  {
    id: 'region-georgia-all',
    name: 'Georgia (Full Country Package)',
    nameKa: 'სრული საქართველო',
    sizeMb: 520,
    bbox: [40.0, 41.0, 46.8, 43.6],
    ...noDownloads,
  },
];
