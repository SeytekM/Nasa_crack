/**
 * Preset places and Trend Map regions. Every preset is bundled by
 * `npm run prefetch` so it works offline.
 */
import type { VarCode } from '../data/catalog';
import type { BBox } from '../data/types';

export interface Place {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
}

export const PRESETS: Place[] = [
  { id: 'bishkek', name: 'Bishkek', country: 'Kyrgyzstan', lat: 42.87, lon: 74.59 },
  { id: 'tian-shan', name: 'Tian Shan peaks', country: 'Kyrgyzstan', lat: 42.0, lon: 78.5 },
  { id: 'almaty-mountains', name: 'Zailiysky Alatau (above Almaty)', country: 'Kazakhstan', lat: 43.0, lon: 77.5 },
  { id: 'ili-plains', name: 'Ili River plains', country: 'Kazakhstan', lat: 44.5, lon: 78.125 },
  { id: 'issyk-kul', name: 'Issyk-Kul shore (Cholpon-Ata)', country: 'Kyrgyzstan', lat: 42.65, lon: 77.08 },
  { id: 'svalbard', name: 'Longyearbyen, Svalbard', country: 'Norway', lat: 78.22, lon: 15.65 },
  { id: 'aral', name: 'Former Aral Sea bed', country: 'Kazakhstan/Uzbekistan', lat: 45.0, lon: 59.5 },
  { id: 'kenya-highlands', name: 'Kenyan highlands', country: 'Kenya', lat: 1.0, lon: 36.25 },
  { id: 'victoria-north', name: 'Lake Victoria north shore', country: 'Uganda', lat: 0.5, lon: 31.875 },
  { id: 'sahara', name: 'Tamanrasset, Sahara', country: 'Algeria', lat: 22.79, lon: 5.53 },
  { id: 'manaus', name: 'Manaus, Amazon', country: 'Brazil', lat: -3.12, lon: -60.02 },
  { id: 'niamey', name: 'Niamey, Sahel', country: 'Niger', lat: 13.51, lon: 2.11 },
  { id: 'delhi', name: 'New Delhi', country: 'India', lat: 28.61, lon: 77.21 },
  { id: 'phoenix', name: 'Phoenix', country: 'USA', lat: 33.45, lon: -112.07 },
  { id: 'yakutsk', name: 'Yakutsk', country: 'Russia', lat: 62.03, lon: 129.73 },
  { id: 'madrid', name: 'Madrid', country: 'Spain', lat: 40.42, lon: -3.7 },
  { id: 'sydney', name: 'Sydney', country: 'Australia', lat: -33.87, lon: 151.21 },
];

export interface TrendRegion {
  id: string;
  name: string;
  bbox: BBox;
  /** Parameters bundled for this region. */
  params: VarCode[];
}

/** Bundled Trend Map regions (each ≤ 10° × 10°, POWER's limit). */
export const TREND_REGIONS: TrendRegion[] = [
  { id: 'east-africa', name: 'East Africa (Lake Victoria – Kenya)', bbox: { latMin: -5, latMax: 5, lonMin: 30, lonMax: 40 }, params: ['PRECTOTCORR', 'T2M'] },
  { id: 'central-asia', name: 'Central Asia (Tian Shan)', bbox: { latMin: 38, latMax: 48, lonMin: 70, lonMax: 80 }, params: ['PRECTOTCORR', 'T2M', 'SNODP'] },
  { id: 'svalbard', name: 'Svalbard & Barents Sea', bbox: { latMin: 72, latMax: 82, lonMin: 10, lonMax: 20 }, params: ['T2M'] },
  { id: 'aral', name: 'Aral Sea basin', bbox: { latMin: 40, latMax: 50, lonMin: 55, lonMax: 65 }, params: ['T2M_MAX'] },
  { id: 'amazon', name: 'Southern Amazon', bbox: { latMin: -10, latMax: 0, lonMin: -65, lonMax: -55 }, params: ['PRECTOTCORR'] },
];

export function findPreset(id: string): Place | undefined {
  return PRESETS.find((p) => p.id === id);
}
