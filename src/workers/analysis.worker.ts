/**
 * Heavy computations off the main thread (Comlink): Detective Scan over all
 * variables and per-cell trend tests for the Trend Map.
 */
import { expose } from 'comlink';
import { scanPoint, trendMapCells, type ScanInput, type TrendMapInput } from './analysisCore';

const api = {
  scan(input: ScanInput) {
    return scanPoint(input);
  },
  trendMap(input: TrendMapInput) {
    return trendMapCells(input);
  },
};

export type AnalysisWorkerApi = typeof api;

expose(api);
