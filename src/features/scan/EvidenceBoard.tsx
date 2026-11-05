import { useEffect, useState } from 'react';
import { CATALOG } from '../../data/catalog';
import type { Loaded, PointDataset } from '../../data/types';
import { useT } from '../../content/i18n';
import { Modal } from '../../components/Modal';
import { Stamp } from '../../components/Stamp';
import { Sparkline } from '../../components/Sparkline';
import { Term } from '../../components/Term';
import { Icon } from '../../components/Icon';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { downloadText, slug, toCsv } from '../../lib/download';
import { autoDecimals, fmt, fmtPEq, fmtSigned, withUnits } from '../../lib/format';
import { directionColor } from '../../lib/palette';
import { useCountUp } from '../../lib/useCountUp';
import { useStore } from '../../state/store';
import { analysisWorker } from '../../workers/client';
import type { ScanRow } from '../../workers/analysisCore';

function EvidenceCard({ row, onOpen }: { row: ScanRow; onOpen: () => void }) {
  const t = useT();
  const meta = CATALOG[row.code];
  const animated = useCountUp(row.perDecade);
  const sign = Math.sign(row.perDecade);
  const color = directionColor(sign, row.code);
  const insufficient = row.verdict === 'insufficient';
  return (
    <li className={`panel flex flex-col gap-2 p-4 ${row.verdict === 'significant' ? 'border-[color-mix(in_srgb,var(--stamp-sig)_45%,var(--line))]' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">{t.vars[row.code].name}</h3>
          <div className="mono text-[10px] text-ink-3">
            {row.code} · {row.from}–{row.to}
          </div>
        </div>
        <div className="shrink-0 pt-1">
          <Stamp verdict={row.verdict} size="sm" animate={false} />
        </div>
      </div>
      {!insufficient ? (
        <>
          <div className="num text-[22px] font-medium leading-tight text-ink-1">
            <span aria-hidden="true" style={{ color }}>
              {sign > 0 ? '▲' : sign < 0 ? '▼' : '•'}{' '}
            </span>
            {withUnits(fmtSigned(animated, autoDecimals(row.perDecade)), meta.annualUnits)}
            <span className="ml-1 text-[12px] font-normal text-ink-3">{t.scan.perDecadeShort}</span>
          </div>
          <Sparkline points={row.spark} color={color} width={260} height={40} label={t.scan.sparkLabel(t.vars[row.code].name)} />
          <div className="num text-[11px] text-ink-3">
            {fmtPEq(row.p)} · {fmtPEq(row.q, 'q')} · S/N {fmt(row.signalToNoise, 1)}
          </div>
        </>
      ) : (
        <div className="text-[13px] text-ink-3">{row.warnings.includes('constant') ? t.warnings.constant : t.verdict.explain.insufficient}</div>
      )}
      {row.warnings.includes('possible-step') && (
        <p className="flex gap-1.5 text-[12px] text-ink-2">
          <Icon name="warning" size={14} className="mt-0.5 shrink-0 text-stamp-sug" /> {t.scan.stepShort}
        </p>
      )}
      {row.verdict !== row.verdictRaw && !insufficient && <p className="text-[12px] text-ink-3">{t.scan.unadjusted(t.verdict.label[row.verdictRaw])}</p>}
      <button type="button" onClick={onOpen} className="mt-auto self-start pt-1 text-[13px] text-accent hover:underline">
        {t.scan.open} →
      </button>
    </li>
  );
}

export default function EvidenceBoard({ loaded, placeName, onClose }: { loaded: Loaded<PointDataset>; placeName: string; onClose: () => void }) {
  const t = useT();
  const { setVar } = useStore();
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    analysisWorker()
      .scan({ data: loaded.data })
      .then((r) => alive && setRows(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [loaded]);

  const sig = rows?.filter((r) => r.verdict === 'significant').length ?? 0;
  const sug = rows?.filter((r) => r.verdict === 'suggestive').length ?? 0;
  const tested = rows?.filter((r) => r.verdict !== 'insufficient').length ?? 0;

  const exportCsv = () => {
    if (!rows) return;
    const csv = toCsv([
      [`# ${t.app.name} — Detective Scan at ${placeName}, ${new Date().toISOString()}`],
      [`# ${t.footer.power}`],
      [`# Source request: ${loaded.data.url}`],
      ['variable', 'from', 'to', 'n_years', 'slope_per_decade', 'ci95_low', 'ci95_high', 'units', 'p_ar1_adjusted', 'q_bh', 'mk_p', 'signal_to_noise', 'verdict_q', 'warnings'],
      ...rows.map((r) => [r.code, r.from, r.to, r.n, r.perDecade, r.ciLow, r.ciHigh, `${CATALOG[r.code].annualUnits}/decade`, r.p, r.q, r.mkP, r.signalToNoise, r.verdict, r.warnings.join(' ')]),
    ]);
    downloadText(`etd-scan-${slug(placeName)}.csv`, csv);
  };

  return (
    <Modal title={t.scan.title} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-2">{t.scan.subtitle(tested, placeName)}</p>
        <ProvenanceChip loaded={loaded} />
      </div>
      <div className="mb-4 rounded-xl border border-line bg-surface-2 p-3 text-[13px] text-ink-2">
        <strong className="text-ink-1">
          <Term id="q-value">{t.scan.qValue}</Term>:
        </strong>{' '}
        {t.scan.qHelp}
      </div>
      {error && (
        <p role="alert" className="text-stamp-sug">
          {error}
        </p>
      )}
      {!rows && !error && (
        <div aria-busy="true">
          <p className="mb-3 text-ink-2">{t.scan.running}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton h-36" />
            ))}
          </div>
        </div>
      )}
      {rows && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="num text-[13px] text-ink-1" role="status">
              {t.scan.summary(sig, sug, tested)}
            </p>
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[13px] text-ink-2 hover:text-ink-1">
              <Icon name="download" size={14} /> {t.scan.exportCsv}
            </button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t.scan.title}>
            {rows.map((r) => (
              <EvidenceCard
                key={r.code}
                row={r}
                onOpen={() => {
                  setVar(r.code);
                  onClose();
                }}
              />
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-ink-3">{t.scan.sortedBy}</p>
        </>
      )}
    </Modal>
  );
}
