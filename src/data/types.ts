/** Where a dataset came from — always shown to the user. */
export type Provenance = 'live' | 'cached' | 'bundled' | 'uploaded';

export interface BBox {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

/** Compact monthly point dataset (one array per parameter, Jan of `start` onward). */
export interface PointDataset {
  kind: 'point';
  v: 1;
  lat: number;
  lon: number;
  /** Grid-cell elevation reported by POWER (m). */
  elevation: number | null;
  start: number;
  end: number;
  params: Record<string, (number | null)[]>;
  units: Record<string, string>;
  sources: string[];
  apiVersion: string;
  fetchedAt: string;
  url: string;
}

/** Compact monthly regional dataset for one parameter. */
export interface RegionalDataset {
  kind: 'regional';
  v: 1;
  param: string;
  bbox: BBox;
  /** Cell-centre latitudes, ascending. */
  lats: number[];
  /** Cell-centre longitudes, ascending. */
  lons: number[];
  start: number;
  end: number;
  /** values[i * lons.length + j] = monthly series of cell (lats[i], lons[j]); null cell = not returned. */
  values: ((number | null)[] | null)[];
  units: string;
  sources: string[];
  apiVersion: string;
  fetchedAt: string;
  url: string;
}

export interface Loaded<T> {
  data: T;
  provenance: Provenance;
  /** Set when we fell back to bundled/cached data after a failed live request. */
  fallbackReason?: string;
}

export interface PointRequest {
  lat: number;
  lon: number;
  params: string[];
  start: number;
  end: number;
}

export interface RegionalRequest {
  bbox: BBox;
  param: string;
  start: number;
  end: number;
}
