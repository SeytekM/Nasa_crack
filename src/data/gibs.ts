/**
 * NASA GIBS helpers. Layer names, formats and TileMatrixSets were checked in
 * the EPSG:3857 GetCapabilities document (docs/DATA_NOTES.md §5).
 */
import type { BBox } from './types';

export const GIBS_WMTS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
/** Blue Marble tiles up to this zoom are bundled (public/data/demo/tiles/bm) for offline use. */
export const OFFLINE_TILE_MAX_ZOOM = 4;

export const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

export interface GibsLayer {
  id: string;
  format: 'jpeg' | 'png';
  tileMatrixSet: string;
  maxZoom: number;
  /** Daily layer → needs a {Time} segment. */
  temporal: boolean;
  /** First date with imagery (temporal layers). */
  firstDate?: string;
}

export const GIBS_LAYERS = {
  blueMarble: {
    id: 'BlueMarble_ShadedRelief_Bathymetry',
    format: 'jpeg',
    tileMatrixSet: 'GoogleMapsCompatible_Level8',
    maxZoom: 8,
    temporal: false,
  },
  modisTerra: {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    format: 'jpeg',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    maxZoom: 9,
    temporal: true,
    firstDate: '2000-02-24',
  },
  labels: {
    // Reference_Labels_15m returned HTTP 500 for many tiles (2026-11-05); this one is reliable.
    id: 'Reference_Labels',
    format: 'png',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    maxZoom: 9,
    temporal: false,
  },
  coastlines: {
    id: 'Coastlines_15m',
    format: 'png',
    tileMatrixSet: 'GoogleMapsCompatible_Level13',
    maxZoom: 13,
    temporal: false,
  },
} as const satisfies Record<string, GibsLayer>;

/** XYZ tile URL template for MapLibre raster sources ({z}/{y}/{x} order as in GIBS ResourceURL). */
export function gibsTileUrl(layer: GibsLayer, date?: string): string {
  const time = layer.temporal ? `${date ?? 'default'}/` : '';
  return `${GIBS_WMTS}/${layer.id}/default/${time}${layer.tileMatrixSet}/{z}/{y}/{x}.${layer.format}`;
}

/**
 * WMS GetMap snapshot (EPSG:4326, WMS 1.3.0 → BBOX axis order lat,lon).
 * Used by the Time Machine: one image per date.
 */
export function gibsSnapshotUrl(bbox: BBox, date: string, opts: { width?: number; layer?: string } = {}): string {
  const width = opts.width ?? 800;
  const aspect = (bbox.lonMax - bbox.lonMin) / (bbox.latMax - bbox.latMin) / Math.cos((((bbox.latMin + bbox.latMax) / 2) * Math.PI) / 180);
  const height = Math.max(64, Math.round(width / Math.max(0.2, Math.min(5, aspect))));
  const q = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: opts.layer ?? GIBS_LAYERS.modisTerra.id,
    STYLES: '',
    CRS: 'EPSG:4326',
    BBOX: [bbox.latMin, bbox.lonMin, bbox.latMax, bbox.lonMax].join(','),
    WIDTH: String(width),
    HEIGHT: String(height),
    FORMAT: 'image/jpeg',
    TIME: date,
  });
  return `${GIBS_WMS}?${q}`;
}

/** Yesterday (UTC) as YYYY-MM-DD — today's imagery is often incomplete. */
export function recentGibsDate(now = new Date()): string {
  const d = new Date(now.getTime() - 2 * 86400000);
  return d.toISOString().slice(0, 10);
}
