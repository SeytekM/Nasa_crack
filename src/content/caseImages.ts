import type { BBox } from '../data/types';

/**
 * Hand-picked cloud-free MODIS Terra dates (same season) for the Time Machine
 * in Case Files. Chosen by inspecting GIBS snapshots on 2026-11-05.
 */
export interface CaseImageSet {
  id: string;
  bbox: BBox;
  dates: [string, string];
}

export const CASE_IMAGES: CaseImageSet[] = [
  { id: 'aral', bbox: { latMin: 43, latMax: 47, lonMin: 57.5, lonMax: 62.5 }, dates: ['2000-08-28', '2025-08-10'] },
];

export function caseImageFile(id: string, date: string): string {
  return `demo/images/${id}-${date}.jpg`;
}
