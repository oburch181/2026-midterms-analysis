import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS,
  RAW_RACES_2026,
  buildFullAnalysisReport,
  computeCombinedAdjustedMetrics,
  computeMeanPureDemographicShift,
} from '../analysis';
import {
  BenchmarkMode,
  STATEWIDE_RACES_2026,
  formatPartyMargin,
  formatSignedMargin,
} from '../data/electionData';

interface DemographicStorySectionProps {
  benchmarkMode: BenchmarkMode;
  nationalAvgShift: number;
  onSelectState: (code: string) => void;
}

type BreakdownSortKey = 'adjusted' | 'raw' | 'demo';

const CASE_STUDY_IDS = ['TX-SEN', 'TX-GOV', 'IA-GOV', 'PA-GOV', 'WV-SEN'];

export function DemographicStorySection({
  benchmarkMode,
  nationalAvgShift,
  onSelectState,
}: DemographicStorySectionProps) {
  const demographicShifts = DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS;
  const [isFullTableOpen, setIsFullTableOpen] = useState<boolean>(false);
  const [breakdownSortKey, setBreakdownSortKey] = useState<BreakdownSortKey>('adjusted');

  const raceMetaById = useMemo(
    () => new Map(STATEWIDE_RACES_2026.map((r) => [r.id, r])),
    []
  );

  const meanPureDemo = useMemo(
    () => computeMeanPureDemographicShift(RAW_RACES_2026, demographicShifts, benchmarkMode),
    [demographicShifts, benchmarkMode]
  );

  const combinedMetrics = useMemo(
    () => computeCombinedAdjustedMetrics(RAW_RACES_2026, demographicShifts, benchmarkMode),
    [demographicShifts, benchmarkMode]
  );

  const caseStudyRows = useMemo(() => {
    return CASE_STUDY_IDS.map((id) => combinedMetrics.find((m) => m.race.id === id)).filter(
      (item): item is NonNullable<typeof item> => Boolean(item)
    );
  }, [combinedMetrics]);

  const txSen = combinedMetrics.find((m) => m.race.id === 'TX-SEN');
  const txGov = combinedMetrics.find((m) => m.race.id === 'TX-GOV');
  const iaGov = combinedMetrics.find((m) => m.race.id === 'IA-GOV');
  const wvSen = combinedMetrics.find((m) => m.race.id === 'WV-SEN');

  const sortedBreakdownRows = useMemo(() => {
    return [...combinedMetrics].sort((a, b) => {
      if (breakdownSortKey === 'raw') return b.rawShift - a.rawShift;
      if (breakdownSortKey === 'demo') return b.demographicWeight - a.demographicWeight;
      return b.adjustedDifference - a.adjustedDifference;
    });
  }, [combinedMetrics, breakdownSortKey]);

  function handleExportJson() {
    const report = buildFullAnalysisReport({
      benchmarkMode,
      demographicShifts,
    });
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `2026-midterm-analysis-${benchmarkMode}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section id="demographics" className="py-12 border-t border-stone-200 scroll-mt-20">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
            04 · The Demographic Story · How CVAP Composition Changes the Map
          </p>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-stone-900 mt-1">
            Why Texas and West Virginia Tell Opposite Stories Under the Hood
          </h2>
          <p className="text-sm text-stone-600 mt-2 leading-relaxed">
            Raw statewide swings treat every voter pool identically. By weighting each state&apos;s
            Census Citizen Voting-Age Population (CVAP) shares against 2026 national exit-poll shifts,
            we separate <em>who lives in a state</em> from <em>how much extra ground a candidate won</em>.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportJson}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-stone-900 text-[#FBF9F5] hover:bg-stone-800 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3 h-3" />
          <span>Export Analysis JSON</span>
        </button>
      </div>

      {/* Part A: Two-Weight Demographic Formula */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <div className="p-5 bg-[#F5F2EB] border border-stone-200 rounded-lg">
          <p className="font-mono text-xs font-semibold text-[#1E3A8A]">
            Step 1 · National Mean Tide (+{nationalAvgShift.toFixed(1)} pts)
          </p>
          <p className="mt-2 text-xs sm:text-sm text-stone-700 leading-relaxed">
            Every 2026 race rode a broad anti-incumbent wave averaging{' '}
            <strong className="font-mono">+{nationalAvgShift.toFixed(1)} pts</strong>{' '}
            ({benchmarkMode === 'unweighted' ? 'equal state mean' : 'ballot-weighted'}). Subtracting
            the national mean removes the baseline tide so we do not credit individual candidates for
            a nationwide swing.
          </p>
        </div>

        <div className="p-5 bg-[#F5F2EB] border border-stone-200 rounded-lg">
          <p className="font-mono text-xs font-semibold text-[#0F766E]">
            Step 2 · State Demographic CVAP Tilt (vs. +{meanPureDemo.toFixed(1)} avg)
          </p>
          <p className="mt-2 text-xs sm:text-sm text-stone-700 leading-relaxed">
            Exit polls from SSRS, UCLA LPPI, and <em>The Washington Post</em> show Hispanic voters
            rebounded <strong className="font-mono">+{demographicShifts.hispanic.toFixed(1)} pts</strong>{' '}
            while White voters shifted <strong className="font-mono">+{demographicShifts.white.toFixed(1)} pts</strong>.
            States with large Latino and AAPI shares carry a positive expected demographic tilt;
            heavily White states carry a negative tilt.
          </p>
        </div>
      </div>

      {/* Part B: Narrative & Case-Study Step Table */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-display font-semibold text-stone-900">
          How Demographics Flip the Texas vs. Midwest Story
        </h3>
        {txSen && txGov && iaGov && wvSen && (
          <div className="mt-2 space-y-3 text-sm text-stone-700 leading-relaxed max-w-4xl">
            <p>
              Start with Texas, where Democrat <strong>James Talarico</strong> (
              <strong className="font-mono">{formatSignedMargin(txSen.rawShift)}</strong> raw) and
              Governor-elect <strong>Gina Hinojosa</strong> (
              <strong className="font-mono">{formatSignedMargin(txGov.rawShift)}</strong> raw)
              shared the same electorate on the same night. Texas&apos;s 32.3% Hispanic CVAP share
              gives it a{' '}
              <strong className="font-mono">
                {formatSignedMargin(txSen.demographicWeight)} pt
              </strong>{' '}
              demographic tailwind above the national tracked average (expected shift{' '}
              <strong className="font-mono">+{txSen.adjustedDemographicBenchmark.toFixed(1)}</strong>
              ). Subtracting only the national mean leaves Hinojosa comfortably ahead (
              <span className="font-mono">{formatSignedMargin(txGov.afterMeanResidual)}</span>).
              Subtracting Texas&apos;s demographic rebound puts Hinojosa essentially right at
              expectation (
              <strong className="font-mono text-[#0F766E]">
                {formatSignedMargin(txGov.adjustedDifference)} pts
              </strong>
              ), whereas Talarico still beats the demographic benchmark by{' '}
              <strong className="font-mono text-[#0F766E]">
                {formatSignedMargin(txSen.adjustedDifference)} pts
              </strong>
              .
            </p>
            <p>
              The mirror image happens in overwhelmingly White states. In Iowa (89.0% White CVAP)
              and West Virginia (92.9% White CVAP), national demographic weights predict slower
              swings (<span className="font-mono">{formatSignedMargin(iaGov.demographicWeight)}</span>{' '}
              and <span className="font-mono">{formatSignedMargin(wvSen.demographicWeight)}</span>{' '}
              pts below the national mean). Once that headwind is factored in,{' '}
              <strong>Rob Sand</strong>&apos;s IA-Gov win rises to{' '}
              <strong className="font-mono text-[#0F766E]">
                {formatSignedMargin(iaGov.adjustedDifference)} pts
              </strong>{' '}
              and West Virginia&apos;s 21.5-point Senate compression jumps to{' '}
              <strong className="font-mono text-[#0F766E]">
                {formatSignedMargin(wvSen.adjustedDifference)} pts
              </strong>{' '}
              above demographic expectations.
            </p>
          </div>
        )}

        <div className="mt-5 overflow-x-auto border border-stone-200 rounded-lg">
          <table className="w-full text-left border-collapse min-w-[700px] text-xs sm:text-sm">
            <thead className="bg-[#F7F4EE] border-b border-stone-200 text-xs text-stone-500">
              <tr>
                <th className="py-2.5 px-4 font-medium">Case-Study Race (Click to Inspect Map)</th>
                <th className="py-2.5 px-3 font-medium text-right">Raw Diff.</th>
                <th className="py-2.5 px-3 font-medium text-right">Mean-Adjusted</th>
                <th className="py-2.5 px-3 font-medium text-right">State Demo Tilt</th>
                <th className="py-2.5 px-4 font-medium text-right">Demo-Adjusted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {caseStudyRows.map((row) => {
                const uiRace = raceMetaById.get(row.race.id);
                return (
                  <tr
                    key={row.race.id}
                    onClick={() => {
                      onSelectState(row.race.stateCode);
                      document.getElementById('state-map')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="hover:bg-stone-50 cursor-pointer"
                  >
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-stone-900">
                        {row.race.stateCode} {row.race.office === 'Senate' ? 'Sen' : 'Gov'} ·{' '}
                        {row.race.featuredCandidate}
                      </span>
                      <span className="block text-[11px] text-stone-500">
                        2024: {formatPartyMargin(row.race.presMargin2024)} · {row.profile.white}%
                        White / {row.profile.hispanic}% Hisp · {uiRace?.faction}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#1E3A8A] font-medium">
                      {formatSignedMargin(row.rawShift)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-700">
                      {formatSignedMargin(row.afterMeanResidual)}
                      <span className="block text-[10px] text-stone-400">
                        (−{row.meanWeight.toFixed(1)} tide)
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-700">
                      {formatSignedMargin(row.demographicWeight)}
                      <span className="block text-[10px] text-stone-400">
                        ({row.pureDemographicShift.toFixed(1)}% pure)
                      </span>
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono font-semibold tabular-nums ${
                        row.adjustedDifference >= 0 ? 'text-[#0F766E]' : 'text-[#9A3412]'
                      }`}
                    >
                      {formatSignedMargin(row.adjustedDifference)} pts
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collapsible Full 42-Race Demographic Table */}
      <div className="border border-stone-200 rounded-lg bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setIsFullTableOpen((prev) => !prev)}
          aria-expanded={isFullTableOpen}
          className="w-full px-5 sm:px-6 py-4 flex items-center justify-between gap-4 text-left bg-[#F7F4EE] hover:bg-[#EFECE5] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            {isFullTableOpen ? (
              <ChevronDown className="w-4 h-4 text-stone-700 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-stone-700 shrink-0" />
            )}
            <div>
              <span className="text-sm sm:text-base font-display font-semibold text-stone-900">
                Complete {STATEWIDE_RACES_2026.length}-Race Demographic Breakdown Table
              </span>
              <span className="block text-xs text-stone-500">
                Inspect state CVAP tilt, expected shift, and Demographic-Adjusted Difference for every race
              </span>
            </div>
          </div>
          <span className="text-xs font-mono text-[#1E3A8A] shrink-0 hidden sm:inline">
            {isFullTableOpen ? 'Hide table' : 'Expand full table'}
          </span>
        </button>

        {isFullTableOpen && (
          <div className="border-t border-stone-200">
            <div className="px-5 py-3 border-b border-stone-200 flex items-center justify-between bg-[#FBF9F5]">
              <span className="text-xs text-stone-500">
                Click any row to highlight that state on the map in Section 01.
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-stone-500">Sort by:</span>
                <select
                  aria-label="Sort full demographic table"
                  value={breakdownSortKey}
                  onChange={(e) => setBreakdownSortKey(e.target.value as BreakdownSortKey)}
                  className="bg-white border border-stone-300 rounded px-2.5 py-1.5 text-xs text-stone-800 focus:outline-2 focus:outline-[#1E3A8A]"
                >
                  <option value="adjusted">Demographic-Adjusted Diff.</option>
                  <option value="raw">Raw Shift vs. 2024</option>
                  <option value="demo">State Demographic Tilt</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse min-w-[700px] text-xs sm:text-sm">
                <thead className="sticky top-0 bg-[#FBF9F5] border-b border-stone-200 text-xs text-stone-500 z-10">
                  <tr>
                    <th className="py-2.5 px-5 font-medium">Race &amp; Candidate</th>
                    <th className="py-2.5 px-3 font-medium text-right">Raw Diff.</th>
                    <th className="py-2.5 px-3 font-medium text-right">Mean-Adjusted</th>
                    <th className="py-2.5 px-3 font-medium text-right">Demo Tilt</th>
                    <th className="py-2.5 px-5 font-medium text-right">Demo-Adjusted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {sortedBreakdownRows.map((row) => (
                    <tr
                      key={row.race.id}
                      onClick={() => {
                        onSelectState(row.race.stateCode);
                        document.getElementById('state-map')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-5">
                        <span className="font-semibold text-stone-900">
                          {row.race.stateCode} {row.race.office === 'Senate' ? 'Sen' : 'Gov'} ·{' '}
                          {row.race.featuredCandidate}
                        </span>
                        <span className="block text-[11px] text-stone-500">
                          {row.race.faction}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium tabular-nums text-[#1E3A8A]">
                        {formatSignedMargin(row.rawShift)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium tabular-nums text-stone-800">
                        {formatSignedMargin(row.afterMeanResidual)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-600">
                        {formatSignedMargin(row.demographicWeight)}
                      </td>
                      <td
                        className={`py-2.5 px-5 text-right font-mono font-semibold tabular-nums ${
                          row.adjustedDifference >= 0 ? 'text-[#0F766E]' : 'text-[#9A3412]'
                        }`}
                      >
                        {formatSignedMargin(row.adjustedDifference)} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
