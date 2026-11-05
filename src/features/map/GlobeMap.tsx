/**
 * MapLibre globe with NASA GIBS imagery. Lazy-loaded (MapLibre is heavy).
 */
import { useEffect, useRef, useState } from 'react';
import { Map as MlMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource, type MapMouseEvent, type RasterTileSource } from 'maplibre-gl';
// Vite bundles MapLibre's module worker and gives us its URL (the default
// relative lookup breaks once the library is pre-bundled).
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(maplibreWorkerUrl);
import { GIBS_LAYERS, gibsTileUrl, recentGibsDate } from '../../data/gibs';

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
}

function style(base: BaseLayer): ConstructorParameters<typeof MlMap>[0]['style'] {
  const layer = base === 'modis' ? GIBS_LAYERS.modisTerra : GIBS_LAYERS.blueMarble;
  return {
    version: 8,
    projection: { type: 'globe' },
    sources: {
      base: {
        type: 'raster',
        tiles: [gibsTileUrl(layer, base === 'modis' ? recentGibsDate() : undefined)],
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

export default function GlobeMap({ center, zoom = 2.2, markers, onPick, overlay, onCellClick, baseLayer = 'blueMarble', ariaLabel, flyKey }: GlobeMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markerObjs = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const cb = useRef({ onPick, onCellClick });
  cb.current = { onPick, onCellClick };

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
      setReady(true);
    });
    m.on('click', (e: MapMouseEvent) => {
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
    return () => {
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
    const layer = baseLayer === 'modis' ? GIBS_LAYERS.modisTerra : GIBS_LAYERS.blueMarble;
    src?.setTiles([gibsTileUrl(layer, baseLayer === 'modis' ? recentGibsDate() : undefined)]);
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
        node.setAttribute('aria-label', mk.label);
      }
      return new Marker({ element: node }).setLngLat([mk.lon, mk.lat]).addTo(m);
    });
  }, [markers]);

  // overlay
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource('cells') as GeoJSONSource | undefined)?.setData(overlay?.cells ?? EMPTY);
    (m.getSource('stipple') as GeoJSONSource | undefined)?.setData(overlay?.stipple ?? EMPTY);
  }, [overlay, ready]);

  return <div ref={el} className="h-full w-full" role="application" aria-label={ariaLabel} />;
}
