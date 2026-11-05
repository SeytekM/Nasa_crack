/**
 * Time-series chart (Apache ECharts, modular import, lazy-loaded).
 * The slider below the chart *is* the analysis period: moving it recomputes
 * the statistics.
 */
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, ScatterChart } from 'echarts/charts';
import { AriaComponent, DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ChartModel } from './model';
import type { ChartToggles } from '../../state/store';
import { fmt } from '../../lib/format';
import { useT } from '../../content/i18n';

echarts.use([LineChart, ScatterChart, GridComponent, TooltipComponent, DataZoomComponent, LegendComponent, MarkAreaComponent, AriaComponent, CanvasRenderer]);

export interface TrendChartProps {
  model: ChartModel;
  show: ChartToggles;
  units: string;
  decimals: number;
  theme: 'dark' | 'light';
  onPeriodChange?: (p: [number, number]) => void;
  onReady?: (getPng: () => string) => void;
  height?: number;
  /** Shared y-range (Compare mode). */
  yRange?: [number, number];
  ariaLabel: string;
  /** Hide the zoom slider (compact charts). */
  noZoom?: boolean;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const yearOf = (ms: number) => new Date(ms).getUTCFullYear() + (new Date(ms).getUTCMonth() + 0.5) / 12;

export default function TrendChart({ model, show, units, decimals, theme, onPeriodChange, onReady, height = 360, yRange, ariaLabel, noZoom }: TrendChartProps) {
  const t = useT();
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const cbRef = useRef(onPeriodChange);
  cbRef.current = onPeriodChange;
  const windowRef = useRef(model.window);

  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current, undefined, { renderer: 'canvas' });
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    let timer: number | undefined;
    c.on('datazoom', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const opt = c.getOption() as { dataZoom?: { startValue?: number; endValue?: number }[] };
        const dz = opt.dataZoom?.[0];
        if (!dz || dz.startValue === undefined || dz.endValue === undefined) return;
        const from = Math.round(yearOf(dz.startValue));
        const to = Math.round(yearOf(dz.endValue)) - 1;
        const [w0, w1] = [new Date(windowRef.current[0]).getUTCFullYear(), new Date(windowRef.current[1]).getUTCFullYear() - 1];
        if (to - from >= 2 && (from !== w0 || to !== w1)) cbRef.current?.([from, to]);
      }, 180);
    });
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    windowRef.current = model.window;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const ink2 = css('--ink-2');
    const ink3 = css('--ink-3');
    const line = css('--line');
    const surface = css('--surface-1');
    const cTrend = css('--series-trend');
    const cMa = css('--series-ma');
    const cAnnual = css('--series-annual');
    const cRaw = css('--series-raw');
    const mono = 'IBM Plex Mono, ui-monospace, monospace';
    const delta = model.bandHigh.map(([x, v], i) => [x, v - model.bandLow[i][1]]);
    const lightBoost = theme === 'light' ? 0.5 : 0;
    const start = Date.UTC(model.extent[0], 0, 1);
    const end = Date.UTC(model.extent[1] + 1, 0, 1);

    c.setOption(
      {
        animation: !reduce,
        animationDuration: 300,
        animationDurationUpdate: 300,
        aria: { enabled: true, label: { description: ariaLabel } },
        backgroundColor: 'transparent',
        grid: { left: 58, right: 18, top: 18, bottom: noZoom ? 30 : 74 },
        textStyle: { fontFamily: 'Inter Variable, system-ui, sans-serif' },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'line', lineStyle: { color: ink3, width: 1 } },
          backgroundColor: css('--surface-3'),
          borderColor: css('--line-strong'),
          textStyle: { color: css('--ink-1'), fontSize: 12 },
          formatter: (params: unknown) => {
            const ps = (params as { seriesId: string; value: [number, number | null]; color: string; seriesName: string }[]).filter(
              (p) => p.seriesId !== 'bandLow' && p.seriesId !== 'bandDelta' && p.value[1] !== null && p.value[1] !== undefined,
            );
            if (!ps.length) return '';
            const d = new Date(ps[0].value[0]);
            const head = `<div style="font-family:${mono};font-size:11px;color:${ink2};margin-bottom:4px">${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}</div>`;
            return (
              head +
              ps
                .map(
                  (p) =>
                    `<div style="display:flex;gap:8px;align-items:center;justify-content:space-between"><span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>${p.seriesName}</span><b style="font-family:${mono}">${fmt(p.value[1] as number, decimals)}</b></div>`,
                )
                .join('')
            );
          },
        },
        xAxis: {
          type: 'time',
          min: start,
          max: end,
          axisLine: { lineStyle: { color: css('--line-strong') } },
          axisTick: { show: false },
          axisLabel: { color: ink3, fontFamily: mono, fontSize: 11, hideOverlap: true },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          scale: true,
          min: yRange?.[0],
          max: yRange?.[1],
          name: units,
          nameLocation: 'end',
          nameGap: 8,
          nameTextStyle: { color: ink3, fontFamily: mono, fontSize: 11, align: 'left' },
          axisLabel: { color: ink3, fontFamily: mono, fontSize: 11 },
          splitLine: { lineStyle: { color: line, width: 1 } },
        },
        dataZoom: noZoom
          ? []
          : [
              {
                type: 'slider',
                xAxisIndex: 0,
                startValue: model.window[0],
                endValue: model.window[1],
                height: 26,
                bottom: 14,
                borderColor: line,
                backgroundColor: css('--surface-2'),
                fillerColor: 'rgba(208,122,10,0.14)',
                dataBackground: { lineStyle: { color: ink3, opacity: 0.5 }, areaStyle: { color: ink3, opacity: 0.12 } },
                selectedDataBackground: { lineStyle: { color: cTrend, opacity: 0.8 }, areaStyle: { color: cTrend, opacity: 0.15 } },
                handleStyle: { color: css('--surface-3'), borderColor: cTrend },
                moveHandleStyle: { color: cTrend, opacity: 0.6 },
                textStyle: { color: ink2, fontFamily: mono, fontSize: 11 },
                labelFormatter: (v: number) => String(new Date(v).getUTCFullYear()),
                brushSelect: false,
              },
              { type: 'inside', xAxisIndex: 0, zoomOnMouseWheel: 'shift', moveOnMouseMove: true },
            ],
        series: [
          {
            id: 'raw',
            name: model.anomalies ? `${t.chart.raw} (${t.chart.anomaliesShort.toLowerCase()})` : t.chart.raw,
            type: 'line',
            data: show.raw ? model.monthly : [],
            showSymbol: false,
            connectNulls: false,
            lineStyle: { width: 1 + lightBoost * 0.5, color: cRaw },
            itemStyle: { color: cRaw },
            emphasis: { disabled: true },
            z: 1,
          },
          {
            id: 'ma',
            name: t.chart.ma,
            type: 'line',
            data: show.ma ? model.ma : [],
            showSymbol: false,
            connectNulls: false,
            lineStyle: { width: 2 + lightBoost, color: cMa },
            itemStyle: { color: cMa },
            emphasis: { disabled: true },
            z: 2,
          },
          {
            id: 'bandLow',
            name: 'bandLow',
            type: 'line',
            data: show.trend ? model.bandLow : [],
            stack: 'band',
            // default 'samesign' stacking breaks the band when its lower edge is negative
            stackStrategy: 'all',
            showSymbol: false,
            lineStyle: { opacity: 0 },
            silent: true,
            z: 3,
          },
          {
            id: 'bandDelta',
            name: t.chart.band,
            type: 'line',
            data: show.trend ? delta : [],
            stack: 'band',
            stackStrategy: 'all',
            showSymbol: false,
            lineStyle: { opacity: 0 },
            areaStyle: { color: cTrend, opacity: theme === 'light' ? 0.18 : 0.16 },
            silent: true,
            z: 3,
          },
          {
            id: 'trend',
            name: t.chart.trend,
            type: 'line',
            data: show.trend ? model.trend : [],
            showSymbol: false,
            lineStyle: { width: 2 + lightBoost, color: cTrend, shadowBlur: theme === 'dark' ? 8 : 0, shadowColor: cTrend },
            itemStyle: { color: cTrend },
            emphasis: { disabled: true },
            z: 5,
          },
          {
            id: 'annual',
            name: t.chart.annual,
            type: 'scatter',
            data: show.annual ? model.annual.filter((d) => d[1] !== null) : [],
            symbolSize: 8,
            itemStyle: { color: cAnnual, borderColor: surface, borderWidth: 2 },
            z: 6,
          },
        ],
      },
      { replaceMerge: ['series', 'dataZoom'] },
    );
  }, [model, show, units, decimals, theme, yRange, ariaLabel, noZoom, t]);

  useEffect(() => {
    if (!onReady) return;
    onReady(() => chart.current?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: css('--surface-1') }) ?? '');
  }, [onReady]);

  return <div ref={el} style={{ height }} className="w-full" />;
}
