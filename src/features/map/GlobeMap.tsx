/**
 * MapLibre globe with NASA GIBS imagery. Lazy-loaded (MapLibre is heavy).
 */
import { useEffect, useRef, useState } from 'react';
import { addProtocol, Map as MlMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource, type MapMouseEvent, type RasterTileSource } from 'maplibre-gl';
// Vite bundles MapLibre's module worker and gives us its URL (the default
// relative lookup breaks once the library is pre-bundled).
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Feature, FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(maplibreWorkerUrl);

/**
 * "gibsfb://" = GIBS Blue Marble, network first, falling back to the bundled
 * low-zoom tiles when offline (projector demo without Wi-Fi).
 */
addProtocol('gibsfb', async (params, abort) => {
  const url = params.url.replace('gibsfb://', 'https://');
  try {
    const r = await fetch(url, { signal: abort.signal });
    if (r.ok) return { data: await r.arrayBuffer() };
    throw new Error(String(r.status));
  } catch (err) {
    const m = url.match(/\/(\d+)\/(\d+)\/(\d+)\.jpeg$/);
    if (m && Number(m[1]) <= OFFLINE_TILE_MAX_ZOOM) {
      const r = await fetch(dataUrl(`demo/tiles/bm/${m[1]}/${m[2]}/${m[3]}.jpeg`), { signal: abort.signal });
      if (r.ok) return { data: await r.arrayBuffer() };
    }
    throw err;
  }
});
import { GIBS_LAYERS, gibsTileUrl, OFFLINE_TILE_MAX_ZOOM, recentGibsDate } from '../../data/gibs';
import { dataUrl } from '../../data/loader';

export interface MapMarker {
  lat: number;
  lon: number;
  color: string;
  label?: string;
}

export interface MapOverlay {
  /** Cell polygons with properties { idx, color, sig } */
  cells: FeatureCollection;
  /** Points for stippling significant cells */
  stipple: FeatureCollection;
  /** [[west, south], [east, north]] to fit the view to. */
  bounds?: [[number, number], [number, number]];
}

export type BaseLayer = 'blueMarble' | 'modis';

export interface GlobeMapProps {
  center: { lat: number; lon: number };
  zoom?: number;
  markers: MapMarker[];
  onPick?: (lat: number, lon: number) => void;
  overlay?: MapOverlay | null;
  onCellClick?: (idx: number) => void;
  baseLayer?: BaseLayer;
  ariaLabel: string;
  /** Changing this key triggers a fly-to. */
  flyKey?: string;
  /** Site-check polygon ([lon, lat] open ring) */
  shape?: { ring: [number, number][]; closed: boolean } | null;
  /** While true, clicks add polygon vertices instead of picking a place. */
  drawing?: boolean;
  onDrawClick?: (lat: number, lon: number) => void;
  /** Click on the first vertex closes the polygon. */
  onDrawFinish?: () => void;
}

function baseTiles(base: BaseLayer): string {
  return base === 'modis' ? gibsTileUrl(GIBS_LAYERS.modisTerra, recentGibsDate()) : gibsTileUrl(GIBS_LAYERS.blueMarble).replace('https://', 'gibsfb://');
}

function style(base: BaseLayer): ConstructorParameters<typeof MlMap>[0]['style'] {
  const layer = base === 'modis' ? GIBS_LAYERS.modisTerra : GIBS_LAYERS.blueMarble;
  return {
    version: 8,
    projection: { type: 'globe' },
    sources: {
      base: {
        type: 'raster',
        tiles: [baseTiles(base)],
        tileSize: 256,
        maxzoom: layer.maxZoom,
        attribution: 'Imagery: <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noreferrer">NASA GIBS</a>',
      },
      labels: {
        type: 'raster',
        tiles: [gibsTileUrl(GIBS_LAYERS.labels)],
        tileSize: 256,
        maxzoom: 9,
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#03060c' } },
      { id: 'base', type: 'raster', source: 'base', paint: { 'raster-saturation': -0.15, 'raster-contrast': 0.05 } },
      { id: 'labels', type: 'raster', source: 'labels', minzoom: 3, paint: { 'raster-opacity': 0.85 } },
    ],
    sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] },
  } as ConstructorParameters<typeof MlMap>[0]['style'];
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

function shapeFeatures(shape: GlobeMapProps['shape']): FeatureCollection {
  const ring = shape?.ring ?? [];
  const feats: Feature[] = ring.map((c, i) => ({ type: 'Feature', properties: { first: i === 0 }, geometry: { type: 'Point', coordinates: c } }));
  if (shape?.closed && ring.length >= 3) feats.unshift({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } });
  else if (ring.length >= 2) feats.unshift({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } });
  return { type: 'FeatureCollection', features: feats };
}

export default function GlobeMap({ center, zoom = 2.2, markers, onPick, overlay, onCellClick, baseLayer = 'blueMarble', ariaLabel, flyKey, shape, drawing = false, onDrawClick, onDrawFinish }: GlobeMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markerObjs = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const fittedShape = useRef('');
  const cb = useRef({ onPick, onCellClick, onDrawClick, onDrawFinish, drawing, shape });
  cb.current = { onPick, onCellClick, onDrawClick, onDrawFinish, drawing, shape };

  // create map once
  useEffect(() => {
    if (!el.current) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const m = new MlMap({
      container: el.current,
      style: style(baseLayer),
      center: [center.lon, center.lat],
      zoom,
      attributionControl: { compact: true },
      fadeDuration: reduce ? 0 : 300,
    });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => {
      m.addSource('cells', { type: 'geojson', data: EMPTY });
      m.addSource('stipple', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'cells-fill', type: 'fill', source: 'cells', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.78 } });
      m.addLayer({ id: 'cells-line', type: 'line', source: 'cells', paint: { 'line-color': 'rgba(0,0,0,0.25)', 'line-width': 0.4 } });
      m.addLayer({
        id: 'stipple',
        type: 'circle',
        source: 'stipple',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 1.2, 4, 2, 6, 3.2],
          'circle-color': '#0b0b0b',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 6, 0.9],
        },
      });
      m.addSource('site', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'site-fill', type: 'fill', source: 'site', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#5cc8ff', 'fill-opacity': 0.18 } });
      m.addLayer({
        id: 'site-line',
        type: 'line',
        source: 'site',
        filter: ['!=', ['geometry-type'], 'Point'],
        paint: { 'line-color': '#5cc8ff', 'line-width': 2.5 },
      });
      m.addLayer({
        id: 'site-pts',
        type: 'circle',
        source: 'site',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': ['case', ['get', 'first'], 7, 4.5],
          'circle-color': ['case', ['get', 'first'], '#ffb547', '#5cc8ff'],
          'circle-stroke-color': '#0b0b0b',
          'circle-stroke-width': 1.5,
        },
      });
      setReady(true);
    });
    m.on('click', (e: MapMouseEvent) => {
      if (cb.current.drawing) {
        const ring = cb.current.shape?.ring ?? [];
        if (ring.length >= 3) {
          const first = m.project(ring[0]);
          if (Math.hypot(first.x - e.point.x, first.y - e.point.y) < 14) {
            cb.current.onDrawFinish?.();
            return;
          }
        }
        const ll = e.lngLat.wrap();
        cb.current.onDrawClick?.(ll.lat, ll.lng);
        return;
      }
      const f = m.getLayer('cells-fill') ? m.queryRenderedFeatures(e.point, { layers: ['cells-fill'] }) : [];
      if (f.length && cb.current.onCellClick) {
        cb.current.onCellClick(Number(f[0].properties?.idx));
        return;
      }
      const ll = e.lngLat.wrap();
      cb.current.onPick?.(ll.lat, ll.lng);
    });
    m.on('mousemove', (e: MapMouseEvent) => {
      const over = m.getLayer('cells-fill') && m.queryRenderedFeatures(e.point, { layers: ['cells-fill'] }).length > 0;
      m.getCanvas().style.cursor = over ? 'pointer' : 'crosshair';
    });
    map.current = m;
    if (import.meta.env.DEV) (window as unknown as { __etdMap?: MlMap }).__etdMap = m;
    // MapLibre only tracks window resizes; the container can change size on its own
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // base layer switch
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const src = m.getSource('base') as RasterTileSource | undefined;
    src?.setTiles([baseTiles(baseLayer)]);
  }, [baseLayer, ready]);

  // fly to the centre when the place changes
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const target = { center: [center.lon, center.lat] as [number, number], zoom: Math.max(m.getZoom(), zoom) };
    if (reduce) m.jumpTo(target);
    else m.flyTo({ ...target, duration: 1600, essential: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyKey]);

  // markers
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markerObjs.current.forEach((mk) => mk.remove());
    markerObjs.current = markers.map((mk) => {
      const node = document.createElement('div');
      node.className = 'etd-marker';
      node.style.cssText = `width:18px;height:18px;border-radius:50%;border:3px solid ${mk.color};background:rgba(0,0,0,.35);box-shadow:0 0 0 2px rgba(255,255,255,.85),0 0 16px ${mk.color};`;
      if (mk.label) {
        node.title = mk.label;
        node.setAttribute('role', 'img');
        node.setAttribute('aria-label', mk.label);
      }
      return new Marker({ element: node }).setLngLat([mk.lon, mk.lat]).addTo(m);
    });
  }, [markers]);

  // site polygon
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource('site') as GeoJSONSource | undefined)?.setData(shapeFeatures(shape));
    // zoom to a newly closed polygon (e.g. opened from a share link)
    const key = shape?.closed ? JSON.stringify(shape.ring) : '';
    if (key && key !== fittedShape.current && shape) {
      fittedShape.current = key;
      const lons = shape.ring.map((p) => p[0]);
      const lats = shape.ring.map((p) => p[1]);
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      m.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        { padding: 60, maxZoom: 9, duration: reduce ? 0 : 1200 },
      );
    }
  }, [shape, ready]);

  // no double-click zoom while drawing (double clicks would add two vertices and zoom)
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (drawing) m.doubleClickZoom.disable();
    else m.doubleClickZoom.enable();
  }, [drawing]);

  // overlay
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource('cells') as GeoJSONSource | undefined)?.setData(overlay?.cells ?? EMPTY);
    (m.getSource('stipple') as GeoJSONSource | undefined)?.setData(overlay?.stipple ?? EMPTY);
    if (overlay?.bounds) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      m.fitBounds(overlay.bounds, { padding: 40, duration: reduce ? 0 : 1400, maxZoom: 5.5 });
    }
  }, [overlay, ready]);

  return <div ref={el} className="h-full w-full" role="application" aria-label={ariaLabel} />;
}
