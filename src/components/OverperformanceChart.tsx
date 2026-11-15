import { useMemo, useState } from 'react';
import {
  NationalDemographicShifts,
  RAW_RACES_2026,
  computeCombinedAdjustedMetrics,
} from '../analysis';
import {
  BenchmarkMode,
  FactionLane,
  STATEWIDE_RACES_2026,
  formatPartyMargin,
  formatSignedMargin,
} from '../data/electionData';

interface OverperformanceChartProps {
  benchmarkMode: BenchmarkMode;
  nationalAvgShift: number;
  demographicShifts: NationalDemographicShifts;
  selectedStateCode: string;
  onSelectState: (code: string) => void;
}

type ChartView = 'bars' | 'scatter';
type PrimaryMetricMode = 'adjusted' | 'mean' | 'raw';
type SortMode = 'active' | 'mean' | 'raw' | 'baseline';

const FACTION_COLORS: Record<FactionLane, string> = {
  'Pragmatic Center-Left': '#1E3A8A',
  'Economic Populist & Labor': '#0F766E',
  'Progressive Reformer': '#4338CA',
  'Independent Populist': '#92400E',
  'GOP Resilience Hold': '#9A3412',
};

export function OverperformanceChart({
  benchmarkMode,
  nationalAvgShift,
  demographicShifts,
  selectedStateCode,
  onSelectState,
}: OverperformanceChartProps) {
  const [chartView, setChartView] = useState<ChartView>('bars');
  const [metricMode, setMetricMode] = useState<PrimaryMetricMode>('adjusted');
  const [sortMode, setSortMode] = useState<SortMode>('active');
  const [factionFilter, setFactionFilter] = useState<FactionLane | 'All'>('All');
  const [hoveredRaceId, setHoveredRaceId] = useState<string | null>(null);

  const raceMetaById = useMemo(
    () => new Map(STATEWIDE_RACES_2026.map((r) => [r.id, r])),
    []
  );

  const combinedMetrics = useMemo(
    () => computeCombinedAdjustedMetrics(RAW_RACES_2026, demographicShifts, benchmarkMode),
    [demographicShifts, benchmarkMode]
  );

  const enrichedRaces = useMemo(() => {
    const filtered = combinedMetrics
      .map((m) => {
        const uiRace = raceMetaById.get(m.race.id)!;
        const activeMetric =
          metricMode === 'adjusted'
            ? m.adjustedDifference
            : metricMode === 'mean'
            ? m.afterMeanResidual
            : m.rawShift;
        return {
          ...m,
          uiRace,
          activeMetric,
        };
      })
      .filter((item) => factionFilter === 'All' || item.uiRace.faction === factionFilter);

    return [...filtered].sort((a, b) => {
      if (sortMode === 'raw') return b.rawShift - a.rawShift;
      if (sortMode === 'mean') return b.afterMeanResidual - a.afterMeanResidual;
      if (sortMode === 'baseline') return a.uiRace.presMargin2024 - b.uiRace.presMargin2024;
      return b.activeMetric - a.activeMetric;
    });
  }, [combinedMetrics, raceMetaById, metricMode, factionFilter, sortMode]);

  const focusedItem = useMemo(() => {
    if (hoveredRaceId) {
      return enrichedRaces.find((item) => item.race.id === hoveredRaceId) ?? enrichedRaces[0];
    }
    return (
      enrichedRaces.find((item) => item.uiRace.stateCode === selectedStateCode) ?? enrichedRaces[0]
    );
  }, [hoveredRaceId, selectedStateCode, enrichedRaces]);

  // Scatter coordinate bounds: X (2024 Pres Margin: -45 to +30), Y (2026 Margin: -25 to +42)
  const xMin = -45;
  const xMax = 30;
  const yMin = -25;
  const yMax = 42;
  const svgW = 720;
  const svgH = 440;
  const pad = { top: 24, right: 28, bottom: 48, left: 54 };
  const plotW = svgW - pad.left - pad.right;
  const plotH = svgH - pad.top - pad.bottom;

  const toX = (val: number) => pad.left + ((val - xMin) / (xMax - xMin)) * plotW;
  const toY = (val: number) => pad.top + plotH - ((val - yMin) / (yMax - yMin)) * plotH;

  return (
    <section id="overperformance" className="py-12 border-t border-stone-200 scroll-mt-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
            02 · Raw Diff., Mean-Adjusted &amp; Demo-Adjusted
          </p>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-stone-900 mt-1">
            Who Outran the Tide—and Who Beat Demographics?
          </h2>
          <p className="text-sm text-stone-600 mt-2 max-w-2xl">
            Switch between <strong>Raw Diff.</strong> (2026 vs. 2024),{' '}
            <strong>Mean-Adjusted</strong> (removing the{' '}
            <span className="font-mono">+{nationalAvgShift.toFixed(1)}</span> national wave), and{' '}
            <strong>Demo-Adjusted</strong> (also removing each state&apos;s CVAP demographic tilt).{' '}
            <a
              href="#demographics"
              className="text-[#1E3A8A] underline underline-offset-4 whitespace-nowrap"
            >
              Read the demographic story in Section 04 ↓
            </a>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="inline-flex items-center p-1 bg-[#EFECE5] border border-stone-200 rounded-md">
            <button
              type="button"
              onClick={() => setMetricMode('raw')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                metricMode === 'raw'
                  ? 'bg-stone-900 text-[#FBF9F5]'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Raw Diff.
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('mean')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                metricMode === 'mean'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Mean-Adjusted
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('adjusted')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                metricMode === 'adjusted'
                  ? 'bg-[#0F766E] text-white'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Demo-Adjusted
            </button>
          </div>

          <div className="inline-flex items-center p-1 bg-[#EFECE5] border border-stone-200 rounded-md">
            <button
              type="button"
              onClick={() => setChartView('bars')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartView === 'bars'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Comparison Bars
            </button>
            <button
              type="button"
              onClick={() => setChartView('scatter')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartView === 'scatter'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              2024 vs. 2026 Scatter
            </button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-stone-200">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              'All',
              'Pragmatic Center-Left',
              'Economic Populist & Labor',
              'Progressive Reformer',
              'Independent Populist',
              'GOP Resilience Hold',
            ] as (FactionLane | 'All')[]
          ).map((fac) => (
            <button
              key={fac}
              type="button"
              onClick={() => setFactionFilter(fac)}
              className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                factionFilter === fac
                  ? 'bg-stone-900 text-[#FBF9F5] border-stone-900'
                  : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
              }`}
            >
              {fac}
            </button>
          ))}
        </div>

        {chartView === 'bars' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-stone-500">Sort by:</span>
            <select
              aria-label="Sort races"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="bg-white border border-stone-300 rounded px-2.5 py-1.5 text-xs text-stone-800 focus:outline-2 focus:outline-[#1E3A8A]"
            >
              <option value="active">
                {metricMode === 'adjusted'
                  ? 'Demo-Adjusted'
                  : metricMode === 'mean'
                  ? 'Mean-Adjusted'
                  : 'Raw Diff. (vs. 2024)'}
              </option>
              <option value="mean">Mean-Adjusted</option>
              <option value="raw">Raw Diff. (vs. 2024)</option>
              <option value="baseline">2024 Baseline (Reddest First)</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Chart + Focused Candidate Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-8 bg-white border border-stone-200 rounded-lg p-5 sm:p-6">
          {chartView === 'bars' ? (
            <div>
              <div className="flex items-center justify-between text-xs text-stone-500 mb-4 pb-2 border-b border-stone-100">
                <span>Race &amp; Featured Candidate</span>
                <div className="flex items-center gap-5 font-mono">
                  <span className="hidden sm:inline">
                    {metricMode === 'raw'
                      ? '(Mean / Demo)'
                      : metricMode === 'mean'
                      ? '(Raw / Demo)'
                      : '(Raw / Mean)'}
                  </span>
                  <span className="w-36 text-right">
                    {metricMode === 'adjusted'
                      ? 'Demo-Adjusted'
                      : metricMode === 'mean'
                      ? 'Mean-Adjusted'
                      : 'Raw Diff.'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[540px] overflow-y-auto pr-1">
                {enrichedRaces.map(
                  ({ uiRace, rawShift, afterMeanResidual, adjustedDifference, activeMetric }) => {
                    const isSelected = uiRace.stateCode === selectedStateCode;
                    const maxScale = metricMode === 'raw' ? 28 : 16;
                    const clampedWidth = Math.min(100, (Math.abs(activeMetric) / maxScale) * 100);
                    const factionColor = FACTION_COLORS[uiRace.faction];
                    const subMetrics =
                      metricMode === 'raw'
                        ? `${formatSignedMargin(afterMeanResidual)} / ${formatSignedMargin(adjustedDifference)}`
                        : metricMode === 'mean'
                        ? `${formatSignedMargin(rawShift)} / ${formatSignedMargin(adjustedDifference)}`
                        : `${formatSignedMargin(rawShift)} / ${formatSignedMargin(afterMeanResidual)}`;

                  return (
                    <button
                      key={uiRace.id}
                      type="button"
                      onClick={() => onSelectState(uiRace.stateCode)}
                      onMouseEnter={() => setHoveredRaceId(uiRace.id)}
                      onMouseLeave={() => setHoveredRaceId(null)}
                      className={`w-full text-left grid grid-cols-12 items-center gap-2 px-2.5 py-2 rounded transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#EFECE5] ring-1 ring-stone-400' : 'hover:bg-stone-50'
                      }`}
                    >
                      <div className="col-span-5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: factionColor }}
                            aria-hidden="true"
                          />
                          <span className="text-xs font-semibold text-stone-900 truncate">
                            {uiRace.stateCode} {uiRace.office === 'Senate' ? 'Sen' : 'Gov'} ·{' '}
                            {uiRace.featuredCandidate}
                          </span>
                        </div>
                        <span className="block text-[11px] text-stone-500 pl-4 truncate">
                          {uiRace.faction}
                          {uiRace.flipped ? ' · Flip' : ''}
                        </span>
                      </div>

                      <div className="col-span-5 flex items-center">
                        <div className="w-full h-5 flex items-center relative">
                          <div className="w-1/2 h-full flex justify-end items-center pr-0.5 border-r border-stone-300">
                            {activeMetric < 0 && (
                              <div
                                className="h-3 rounded-l-xs bg-[#C2410C]/85"
                                style={{ width: `${clampedWidth}%` }}
                              />
                            )}
                          </div>
                          <div className="w-1/2 h-full flex justify-start items-center pl-0.5">
                            {activeMetric >= 0 && (
                              <div
                                className="h-3 rounded-r-xs"
                                style={{
                                  width: `${clampedWidth}%`,
                                  backgroundColor: factionColor,
                                }}
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 text-right font-mono text-xs tabular-nums">
                        <span
                          className={`font-semibold ${
                            activeMetric >= 0 ? 'text-[#0F766E]' : 'text-[#9A3412]'
                          }`}
                        >
                          {formatSignedMargin(activeMetric)}
                        </span>
                        <span className="block text-[10px] text-stone-400">
                          ({subMetrics})
                        </span>
                      </div>
                    </button>
                  );
                }
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-stone-600">
                <span>Horizontal: 2024 Pres. Margin · Vertical: 2026 Margin</span>
                <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
                  <span className="text-[#1E3A8A]">--- National Mean (+{nationalAvgShift.toFixed(1)})</span>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="w-full h-auto min-w-[540px]"
                  role="img"
                  aria-label="Scatter plot comparing 2024 presidential baseline margin to 2026 midterm margin"
                >
                  {[-40, -20, 0, 20].map((gx) => (
                    <g key={`gx-${gx}`}>
                      <line
                        x1={toX(gx)}
                        y1={pad.top}
                        x2={toX(gx)}
                        y2={pad.top + plotH}
                        stroke={gx === 0 ? '#A8A29E' : '#E7E5E4'}
                        strokeWidth={gx === 0 ? 1.2 : 1}
                      />
                      <text
                        x={toX(gx)}
                        y={pad.top + plotH + 18}
                        textAnchor="middle"
                        className="fill-stone-500 text-[10px] font-mono"
                      >
                        {gx === 0 ? 'EVEN' : gx > 0 ? `D+${gx}` : `R+${Math.abs(gx)}`}
                      </text>
                    </g>
                  ))}

                  {[-20, 0, 20, 40].map((gy) => (
                    <g key={`gy-${gy}`}>
                      <line
                        x1={pad.left}
                        y1={toY(gy)}
                        x2={pad.left + plotW}
                        y2={toY(gy)}
                        stroke={gy === 0 ? '#A8A29E' : '#E7E5E4'}
                        strokeWidth={gy === 0 ? 1.2 : 1}
                      />
                      <text
                        x={pad.left - 8}
                        y={toY(gy) + 3}
                        textAnchor="end"
                        className="fill-stone-500 text-[10px] font-mono"
                      >
                        {gy === 0 ? 'EVEN' : gy > 0 ? `D+${gy}` : `R+${Math.abs(gy)}`}
                      </text>
                    </g>
                  ))}

                  <line
                    x1={toX(-25)}
                    y1={toY(-25)}
                    x2={toX(30)}
                    y2={toY(30)}
                    stroke="#D6D3D1"
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                  />
                  <text x={toX(20)} y={toY(17)} className="fill-stone-400 text-[10px] font-sans">
                    No shift (2024 parity)
                  </text>

                  <line
                    x1={toX(-25 - nationalAvgShift)}
                    y1={toY(-25)}
                    x2={toX(42 - nationalAvgShift)}
                    y2={toY(42)}
                    stroke="#1E3A8A"
                    strokeOpacity={0.7}
                    strokeWidth={1.6}
                    strokeDasharray="6 4"
                  />

                  <rect
                    x={toX(-20)}
                    y={toY(24)}
                    width={toX(0) - toX(-20)}
                    height={toY(0) - toY(24)}
                    fill="#1E3A8A"
                    fillOpacity={0.04}
                  />
                  <text
                    x={toX(-18.5)}
                    y={toY(21)}
                    className="fill-[#1E3A8A]/70 text-[10px] font-medium"
                  >
                    Trump 2024 → Dem 2026 Wins
                  </text>

                  {enrichedRaces.map(({ uiRace }) => {
                    const cx = toX(uiRace.presMargin2024);
                    const cy = toY(uiRace.demOrCoalitionMargin2026);
                    const isFocused = focusedItem?.race.id === uiRace.id;
                    const color = FACTION_COLORS[uiRace.faction];

                    return (
                      <g
                        key={uiRace.id}
                        className="cursor-pointer"
                        onClick={() => onSelectState(uiRace.stateCode)}
                        onMouseEnter={() => setHoveredRaceId(uiRace.id)}
                        onMouseLeave={() => setHoveredRaceId(null)}
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isFocused ? 7.5 : uiRace.flipped ? 6 : 4.5}
                          fill={color}
                          fillOpacity={isFocused ? 1 : 0.85}
                          stroke={isFocused ? '#1C1917' : '#FFFFFF'}
                          strokeWidth={isFocused ? 2 : 1.2}
                        />
                        {(isFocused || uiRace.flipped || Math.abs(uiRace.presMargin2024) > 28) && (
                          <text
                            x={cx + 8}
                            y={cy + 3}
                            className="fill-stone-800 text-[10px] font-mono font-medium pointer-events-none"
                          >
                            {uiRace.stateCode}
                            {uiRace.office === 'Governor' ? 'g' : 's'}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  <text
                    x={pad.left + plotW / 2}
                    y={svgH - 8}
                    textAnchor="middle"
                    className="fill-stone-600 text-[11px] font-sans"
                  >
                    2024 Presidential Margin (R+ left · D+ right)
                  </text>
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Right: Clean Candidate Spotlight */}
        <aside className="lg:col-span-4 bg-[#F5F2EB] border border-stone-200 rounded-lg p-6 flex flex-col justify-between">
          {focusedItem ? (
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
                Selected Race Summary
              </p>
              <h3 className="text-xl font-display font-semibold text-stone-900 mt-1">
                {focusedItem.uiRace.featuredCandidate} ({focusedItem.uiRace.featuredParty})
              </h3>
              <p className="text-xs text-stone-600 mt-0.5">
                {focusedItem.uiRace.raceLabel} · {focusedItem.uiRace.faction}
              </p>

              <dl className="mt-5 divide-y divide-stone-200 border-t border-b border-stone-200 text-sm">
                <div className="py-2.5 flex justify-between gap-2">
                  <dt className="text-stone-600">2024 Pres. Baseline</dt>
                  <dd className="font-mono font-medium tabular-nums text-stone-900">
                    {formatPartyMargin(focusedItem.uiRace.presMargin2024)}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-2">
                  <dt className="text-stone-600">2026 Result Margin</dt>
                  <dd className="font-mono font-medium tabular-nums text-stone-900">
                    {formatPartyMargin(focusedItem.uiRace.demOrCoalitionMargin2026)}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-2">
                  <dt className="text-stone-600">Raw Diff. (vs. 2024)</dt>
                  <dd className="font-mono font-semibold tabular-nums text-[#1E3A8A]">
                    {formatSignedMargin(focusedItem.rawShift)} pts
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-2">
                  <dt className="text-stone-600">Mean-Adjusted (vs. Tide)</dt>
                  <dd
                    className={`font-mono font-semibold tabular-nums ${
                      focusedItem.afterMeanResidual >= 0 ? 'text-stone-900' : 'text-[#9A3412]'
                    }`}
                  >
                    {formatSignedMargin(focusedItem.afterMeanResidual)} pts
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-2">
                  <dt className="text-stone-600">State Demographic Tilt</dt>
                  <dd className="font-mono font-medium tabular-nums text-stone-700">
                    {formatSignedMargin(focusedItem.demographicWeight)} pts
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-2">
                  <dt className="text-stone-900 font-medium">Demo-Adjusted Diff.</dt>
                  <dd
                    className={`font-mono font-semibold tabular-nums ${
                      focusedItem.adjustedDifference >= 0 ? 'text-[#0F766E]' : 'text-[#9A3412]'
                    }`}
                  >
                    {formatSignedMargin(focusedItem.adjustedDifference)} pts
                  </dd>
                </div>
              </dl>

              <p className="mt-4 text-sm text-stone-700 leading-relaxed">
                {focusedItem.uiRace.summaryNote}
              </p>

              <div className="mt-4">
                <span className="block text-xs font-medium text-stone-800 mb-1.5">
                  Verified Campaign Pillars
                </span>
                <ul className="text-xs text-stone-600 space-y-1">
                  {focusedItem.uiRace.policyPillars.map((pillar) => (
                    <li key={pillar}>· {pillar}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="mt-6 pt-4 border-t border-stone-200 text-xs text-stone-500">
            Hover or click any race bar to inspect Raw vs. Demographic-Adjusted performance.
          </div>
        </aside>
      </div>
    </section>
  );
}
