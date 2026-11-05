/**
 * Case Files: guided tours. Structure only — texts live in the i18n
 * dictionary (en.tours). Every number shown in a tour is computed at runtime
 * from the bundled data (public/data/demo), so text and charts always agree.
 * Each story was checked against the real data (docs/DECISIONS.md D2.8).
 */
import type { VarCode } from '../data/catalog';

export type Scene =
  | {
      kind: 'explore';
      place: string;
      varCode: VarCode;
      period?: [number, number] | null;
      mapRegion?: string | null;
      scan?: boolean;
      highlight?: string;
    }
  | { kind: 'compare'; a: string; b: string; varCode: VarCode; highlight?: string }
  | { kind: 'time-machine'; imageSet: string; highlight?: string };

export interface CaseDef {
  id: CaseId;
  /** Preset ids whose bundled data the tour needs. */
  places: string[];
  steps: Scene[];
}

export type CaseId = 'arctic' | 'aral' | 'snow' | 'bishkek' | 'almost';

export const CASES: CaseDef[] = [
  {
    id: 'snow',
    places: ['ili-plains', 'almaty-mountains'],
    steps: [
      { kind: 'explore', place: 'almaty-mountains', varCode: 'SNODP', mapRegion: 'central-asia', highlight: 'map' },
      { kind: 'compare', a: 'ili-plains', b: 'almaty-mountains', varCode: 'SNODP', highlight: 'compare-diff' },
      { kind: 'compare', a: 'ili-plains', b: 'almaty-mountains', varCode: 'T2M', highlight: 'compare-diff' },
      { kind: 'compare', a: 'ili-plains', b: 'almaty-mountains', varCode: 'QV2M', highlight: 'compare-diff' },
      { kind: 'compare', a: 'ili-plains', b: 'almaty-mountains', varCode: 'PRECTOTCORR', highlight: 'compare-diff' },
    ],
  },
  {
    id: 'arctic',
    places: ['svalbard'],
    steps: [
      { kind: 'explore', place: 'svalbard', varCode: 'T2M', highlight: 'chart' },
      { kind: 'explore', place: 'svalbard', varCode: 'T2M', highlight: 'verdict' },
      { kind: 'explore', place: 'svalbard', varCode: 'SNODP', highlight: 'verdict' },
      { kind: 'explore', place: 'svalbard', varCode: 'FROST_DAYS', highlight: 'verdict' },
      { kind: 'explore', place: 'svalbard', varCode: 'T2M', mapRegion: 'svalbard', highlight: 'trendmap-panel' },
    ],
  },
  {
    id: 'aral',
    places: ['aral'],
    steps: [
      { kind: 'time-machine', imageSet: 'aral', highlight: 'time-machine' },
      { kind: 'explore', place: 'aral', varCode: 'T2M_MAX', highlight: 'verdict' },
      { kind: 'explore', place: 'aral', varCode: 'T2M', highlight: 'yts' },
      { kind: 'explore', place: 'aral', varCode: 'T2M', highlight: 'variable-card' },
      { kind: 'explore', place: 'aral', varCode: 'T2M_MAX', mapRegion: 'aral', highlight: 'trendmap-panel' },
    ],
  },
  {
    id: 'bishkek',
    places: ['bishkek'],
    steps: [
      { kind: 'explore', place: 'bishkek', varCode: 'T2M', highlight: 'verdict' },
      { kind: 'explore', place: 'bishkek', varCode: 'T2M', scan: true },
      { kind: 'explore', place: 'bishkek', varCode: 'CLOUD_AMT', highlight: 'chart' },
    ],
  },
  {
    id: 'almost',
    places: ['issyk-kul'],
    steps: [
      { kind: 'explore', place: 'issyk-kul', varCode: 'T2M_MIN', highlight: 'verdict' },
      { kind: 'explore', place: 'issyk-kul', varCode: 'T2M_MIN', highlight: 'yts' },
      { kind: 'explore', place: 'issyk-kul', varCode: 'T2M_MIN', period: [1981, 2010], highlight: 'period' },
    ],
  },
];
