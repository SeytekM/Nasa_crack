import { lazy, Suspense, useMemo, useState } from 'react';
import type { VariableMeta } from '../../data/catalog';
import { CsvParseError, parseCsvSeries, type ParsedSeries } from '../../data/csv';
import { useT } from '../../content/i18n';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { useStore } from '../../state/store';
import type { AnnualAggregation } from '../../stats';
import { buildModel } from '../analysis/model';
import { StatsPanel } from '../analysis/StatsPanel';

const TrendChart = lazy(() => import('../analysis/TrendChart'));

/** Analyse a user CSV in the browser (nothing is uploaded anywhere). */
export default function UploadModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { show, theme } = useStore();
  const [parsed, setParsed] = useState<ParsedSeries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agg, setAgg] = useState<AnnualAggregation>('mean');
  const [units, setUnits] = useState('');
  const [period, setPeriod] = useState<[number, number] | null>(null);
  const [drag, setDrag] = useState(false);

  const readFile = async (f: File) => {
    setError(null);
    try {
      const p = parseCsvSeries(await f.text(), f.name);
      setParsed(p);
      setUnits(p.units);
      setPeriod(null);
    } catch (e) {
      setParsed(null);
      setError(e instanceof CsvParseError ? e.message : t.upload.genericError);
    }
  };

  const model = useMemo(() => {
    if (!parsed) return null;
    const meta = {
      units: units || '—',
      annualUnits: agg === 'sum' ? `${units || '—'}/yr` : units || '—',
      agg,
      validRange: [-Infinity, Infinity],
      firstYear: parsed.start,
      palette: 'neutral',
      decimals: 3,
    } as unknown as VariableMeta;
    const p: [number, number] = period ?? [parsed.start, parsed.end];
    return { meta, m: buildModel(parsed.records, meta, p, 'annual', true) };
  }, [parsed, agg, units, period]);

  return (
    <Modal title={t.upload.title} onClose={onClose} wide>
      <p className="mb-3 text-[14px] text-ink-2">{t.upload.intro}</p>
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center ${drag ? 'border-accent bg-surface-2' : 'border-line-strong'}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) void readFile(f);
        }}
      >
        <Icon name="upload" size={22} />
        <span className="text-ink-1">{t.upload.drop}</span>
        <span className="text-[12px] text-ink-3">{t.upload.formats}</span>
        <input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" className="sr-only" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} />
      </label>
      {error && (
        <p role="alert" className="mt-3 text-stamp-sug">
          {error}
        </p>
      )}
      {parsed && model && (
        <div className="mt-4 space-y-4">
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-3 text-[13px]">
            <div>
              <div className="font-semibold text-ink-1">{parsed.name}</div>
              <div className="num text-ink-3">{t.upload.summary(parsed.dateColumn, parsed.valueColumn, parsed.rowsUsed, parsed.rowsSkipped, parsed.resolution, parsed.start, parsed.end)}</div>
            </div>
            <ProvenanceChip loaded={{ provenance: 'uploaded' }} />
          </div>
          <div className="flex flex-wrap items-end gap-4 text-[13px]">
            <label className="text-ink-3">
              {t.upload.units}
              <input value={units} onChange={(e) => setUnits(e.target.value)} className="mt-0.5 block w-36 rounded-md border border-line bg-surface-2 px-2 py-1 text-ink-1" />
            </label>
            <label className="text-ink-3">
              {t.upload.agg}
              <select value={agg} onChange={(e) => setAgg(e.target.value as AnnualAggregation)} className="mt-0.5 block rounded-md border border-line bg-surface-2 px-2 py-1 text-ink-1">
                <option value="mean">{t.upload.aggMean}</option>
                <option value="sum">{t.upload.aggSum}</option>
              </select>
            </label>
          </div>
          <Suspense fallback={<div className="skeleton h-[320px]" />}>
            <TrendChart model={model.m.chart} show={show} units={model.meta.units} decimals={3} theme={theme} onPeriodChange={setPeriod} height={320} ariaLabel={parsed.name} />
          </Suspense>
          <StatsPanel m={model.m} info={{ name: parsed.name, annualUnits: model.meta.annualUnits }} />
          {parsed.resolution === 'annual' && <p className="text-[12px] text-ink-3">{t.upload.annualNote}</p>}
        </div>
      )}
    </Modal>
  );
}
