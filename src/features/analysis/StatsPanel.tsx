import { useState } from 'react';
import { CATALOG, type VarCode } from '../../data/catalog';
import { useT } from '../../content/i18n';
import { Stamp } from '../../components/Stamp';
import { Term } from '../../components/Term';
import { Icon } from '../../components/Icon';
import { fmt, fmtP, fmtPEq, fmtSigned, withUnits } from '../../lib/format';
import { reportNumbers, type ModelResult } from './model';
import { useStore } from '../../state/store';

function Figure({ label, value, sub }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface-2 px-3 py-2">
      <div className="text-[12px] leading-tight text-ink-3">{label}</div>
      <div className="num mt-0.5 truncate text-[15px] font-medium text-ink-1">{value}</div>
      {sub && <div className="num text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}

/** What the panel needs to know about the series (catalog variable or uploaded file). */
export interface SeriesInfo {
  name: string;
  annualUnits: string;
  homogeneousFrom?: number;
}

export function useSeriesInfo(code: VarCode): SeriesInfo {
  const t = useT();
  const meta = CATALOG[code];
  return { name: t.vars[code].name, annualUnits: meta.annualUnits, homogeneousFrom: meta.homogeneousFrom };
}

export function Headline({ m, code, info: infoIn }: { m: ModelResult; code?: VarCode; info?: SeriesInfo }) {
  const t = useT();
  const fallback = useSeriesInfo(code ?? 'T2M');
  const meta = infoIn ?? fallback;
  const tr = m.analysis.trend;
  const r = reportNumbers(m);
  if (tr.warnings.includes('constant')) return <p className="text-ink-2">{t.verdict.constant}</p>;
  if (tr.verdict === 'insufficient') return <p className="text-ink-2">{t.verdict.explain.insufficient}</p>;
  const perDecade = withUnits(fmtSigned(r.perDecade), meta.annualUnits);
  const total = withUnits(fmtSigned(r.total), meta.annualUnits);
  const flat = Number(Math.abs(r.perDecade).toPrecision(2)) === 0;
  return (
    <div className="space-y-2">
      <p className="text-[17px] font-medium leading-snug text-ink-1">
        {t.verdict.headline({
          name: meta.name,
          dir: flat ? 'flat' : r.perDecade > 0 ? 'risen' : 'fallen',
          perDecade,
          since: m.period[0],
          total,
          from: Math.round(tr.xStart),
          to: Math.round(tr.xEnd),
        })}
      </p>
      <p className="text-ink-2">
        {t.verdict.chance(tr.p, tr.verdict === 'significant')}{' '}
        <span className="num whitespace-nowrap text-ink-3">({fmtPEq(tr.p)})</span>
      </p>
    </div>
  );
}

export function StatsPanel({ m, code, info: infoIn }: { m: ModelResult; code?: VarCode; info?: SeriesInfo }) {
  const t = useT();
  const [details, setDetails] = useState(false);
  const fallback = useSeriesInfo(code ?? 'T2M');
  const meta = infoIn ?? fallback;
  const tr = m.analysis.trend;
  const r = reportNumbers(m);
  const u = meta.annualUnits;
  const per = (x: number) => withUnits(fmtSigned(x), u);
  const sm = m.analysis.seasonal;
  const solarStepActive = meta.homogeneousFrom !== undefined && m.period[0] < meta.homogeneousFrom;

  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="verdict-heading" data-tour="verdict">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 id="verdict-heading" className="eyebrow">
          {t.explore.resultTitle}
        </h3>
        <Stamp verdict={tr.verdict} key={`${meta.name}-${m.period.join('-')}-${tr.verdict}`} />
      </div>
      <Headline m={m} info={meta} />
      <p className="mt-2 text-[12px] text-ink-3">
        <Term id="significance">{t.glossary.significance.term}</Term>: {t.verdict.explain[tr.verdict]}
      </p>

      {tr.verdict !== 'insufficient' && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Figure
            label={
              <>
                <Term id="trend">{t.stats.slope}</Term> · {t.common.perDecade}
              </>
            }
            value={per(r.perDecade)}
            sub={
              <>
                <Term id="confidence-interval">95% CI</Term> [{fmtSigned(r.ci[0])}, {fmtSigned(r.ci[1])}]
              </>
            }
          />
          <Figure label={t.stats.total} value={per(r.total)} sub={`${Math.round(tr.xStart)}–${Math.round(tr.xEnd)}`} />
          <Figure
            label={<Term id="p-value">{t.stats.pAdj}</Term>}
            value={fmtP(tr.p)}
            sub={
              <>
                {t.stats.plainOls} {fmtP(tr.ols.p)}
              </>
            }
          />
          <Figure
            label={<Term id="mann-kendall">{t.stats.mk}</Term>}
            value={fmtPEq(tr.mk.p)}
            sub={
              <>
                τ = {fmt(tr.mk.tau, 2)} · {t.verdict.label[tr.mkVerdict]}
              </>
            }
          />
          <Figure
            label={<Term id="sens-slope">{t.stats.sen}</Term>}
            value={per(r.sen)}
            sub={`[${fmtSigned(r.senCi[0])}, ${fmtSigned(r.senCi[1])}]`}
          />
          <Figure label={<Term id="signal-to-noise">{t.stats.snr}</Term>} value={fmt(tr.signalToNoise, 1)} sub={`R² = ${fmt(tr.ols.r2, 2)}`} />
        </div>
      )}

      {tr.agreement !== 'agree' && (
        <p className="mt-3 rounded-lg border border-line bg-surface-2 p-3 text-[13px] text-ink-2">
          <Icon name="info" className="mr-1 inline -translate-y-px" size={14} />
          {tr.agreement === 'direction-differs' ? t.stats.disagreeDirection : t.stats.disagreeSignificance}
        </p>
      )}

      {(tr.warnings.filter((w) => w !== 'methods-disagree').length > 0 || solarStepActive) && (
        <ul className="mt-3 space-y-2" aria-label={t.stats.warningsLabel}>
          {solarStepActive && (
            <li className="flex gap-2 rounded-lg border border-[color-mix(in_srgb,var(--stamp-sug)_45%,transparent)] p-3 text-[13px] text-ink-2">
              <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-stamp-sug" />
              {t.solarStepActive}
            </li>
          )}
          {tr.warnings
            .filter((w) => w !== 'methods-disagree' && w !== 'constant')
            .map((w) => (
              <li key={w} className="flex gap-2 rounded-lg border border-[color-mix(in_srgb,var(--stamp-sug)_45%,transparent)] p-3 text-[13px] text-ink-2">
                <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-stamp-sug" />
                <span>
                  {w === 'possible-step' ? <Term id="step-change">{t.glossary['step-change'].term}</Term> : null} {t.warnings[w]}
                  {w === 'possible-step' && tr.step && (
                    <span className="num block pt-1 text-ink-3">
                      {t.stepDetail(Math.round(tr.step.breakX), withUnits(fmtSigned(tr.step.stepSize * m.displayScale), u))}
                    </span>
                  )}
                </span>
              </li>
            ))}
        </ul>
      )}

      {tr.verdict !== 'significant' && tr.verdict !== 'insufficient' && (
        <div className="mt-3 rounded-lg border border-dashed border-line-strong p-3" data-tour="yts">
          <div className="eyebrow mb-1 flex items-center gap-1.5">
            <Icon name="clock" size={13} /> {t.yts.title}
          </div>
          <p className="text-[14px] text-ink-1">{tr.yearsToSignificance ? t.yts.projection(Math.ceil(tr.yearsToSignificance.year)) : t.yts.never}</p>
          <p className="mt-1 text-[12px] text-ink-3">{t.yts.caveat}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-4 text-[13px]">
        <button type="button" className="text-accent hover:underline" aria-expanded={details} onClick={() => setDetails((d) => !d)}>
          {details ? t.common.showLess : t.common.showMore}
        </button>
        <button
          type="button"
          className="text-accent hover:underline"
          onClick={() => {
            useStore.getState().setMode('learn');
            setTimeout(() => document.getElementById('methods')?.scrollIntoView({ block: 'start' }), 300);
          }}
        >
          {t.stats.methods} →
        </button>
      </div>
      {details && tr.verdict !== 'insufficient' && (
        <dl className="num mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px] text-ink-2">
          <dt>{t.stats.n}</dt>
          <dd>{tr.n}</dd>
          <dt>
            <Term id="autocorrelation">{t.stats.r1}</Term>
          </dt>
          <dd>r₁ = {fmt(tr.adj.r1, 2)}</dd>
          <dt>
            <Term id="effective-sample-size">{t.stats.nEff}</Term>
          </dt>
          <dd>{fmt(tr.adj.nEff, 1)}</dd>
          <dt>{t.stats.pRaw}</dt>
          <dd>{fmtP(tr.ols.p)} (t = {fmt(tr.ols.t, 2)}, df = {tr.ols.df})</dd>
          <dt>{t.stats.pAdj}</dt>
          <dd>
            {fmtP(tr.p)} (t = {fmt(tr.adj.t, 2)}, df = {fmt(tr.adj.df, 1)})
          </dd>
          <dt>Mann-Kendall S / Var(S)</dt>
          <dd>
            {tr.mk.s} / {fmt(tr.mk.varS, 0)} · Z = {fmt(tr.mk.z, 2)}
          </dd>
          <dt>{t.stats.mkModified}</dt>
          <dd>p = {fmtP(tr.mkModified.p)}</dd>
          {sm && (
            <>
              <dt>{t.stats.smk}</dt>
              <dd>
                p = {fmtP(sm.p)} · {t.stats.smkSlope} {withUnits(fmtSigned(r.seasonalSen), u)} {t.common.perDecade}
              </dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}
