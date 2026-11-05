import { wrap, type Remote } from 'comlink';
import type { AnalysisWorkerApi } from './analysis.worker';

let api: Remote<AnalysisWorkerApi> | null = null;

/** Lazily created singleton worker. */
export function analysisWorker(): Remote<AnalysisWorkerApi> {
  if (!api) {
    const w = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    api = wrap<AnalysisWorkerApi>(w);
  }
  return api;
}
