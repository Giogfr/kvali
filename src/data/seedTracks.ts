import { RecordedTrack } from '../types';

export const SEED_TRACKS: RecordedTrack[] = [
  {
    id: 'track-kutaisi-gelati',
    title: 'Kutaisi Center to Gelati Monastery',
    date: '2026-03-12',
    distanceKm: 9.8,
    durationMinutes: 22,
    avgSpeedKmh: 26.7,
    coordinates: [
      [42.7001, 42.2679],
      [42.7042, 42.2772],
      [42.7210, 42.2850],
      [42.7480, 42.2910],
      [42.7681, 42.2964],
    ],
    demo: true,
  },
  {
    id: 'track-rioni-walk',
    title: 'Rioni River Promenade Walk',
    date: '2026-03-08',
    distanceKm: 2.4,
    durationMinutes: 34,
    avgSpeedKmh: 4.2,
    coordinates: [
      [42.6983, 42.2699],
      [42.7015, 42.2685],
      [42.7040, 42.2660],
      [42.7058, 42.2642],
    ],
    demo: true,
  },
];
