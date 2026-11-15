import { useMemo, useState } from 'react';
import {
  DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS,
  NationalDemographicShifts,
  RAW_RACES_2026,
  computeCombinedAdjustedMetrics,
} from '../analysis';
import {
  BenchmarkMode,
  FactionLane,
  STATE_TILES,
  STATEWIDE_RACES_2026,
  StatewideRace,
  calculateRaceShift,
  formatPartyMargin,
  formatSignedMargin,
  resolveSourceLinks,
} from '../data/electionData';

type MapMetricMode =
  | 'shift'
  | 'meanAdjusted'
  | 'logitAdjusted'
  | 'overperformance'
  | 'margin'
  | 'faction';
type OfficeFilter = 'all' | 'Senate' | 'Governor';

interface USStateTileMapProps {
  benchmarkMode: BenchmarkMode;
  onChangeBenchmarkMode: (mode: BenchmarkMode) => void;
  nationalAvgShift: number;
  demographicShifts?: NationalDemographicShifts;
  factionOverrides?: Record<string, FactionLane>;
  selectedStateCode: string;
  onSelectState: (code: string) => void;
}

const FACTION_SHORT: Record<string, { abbr: string; bg: string; text: string; border: string }> = {
  'Pragmatic Center-Left': {
    abbr: 'CTR',
    bg: 'bg-[#1E3A8A]',
    text: 'text-white',
    border: 'border-[#172554]',
  },
  'Economic Populist & Labor': {
    abbr: 'POP',
    bg: 'bg-[#0F766E]',
    text: 'text-white',
    border: 'border-[#115E59]',
  },
  'Progressive Reformer': {
    abbr: 'PRG',
    bg: 'bg-[#4338CA]',
    text: 'text-white',
    border: 'border-[#312E81]',
  },
  'Independent Populist': {
    abbr: 'IND',
    bg: 'bg-[#92400E]',
    text: 'text-white',
    border: 'border-[#78350F]',
  },
  'GOP Resilience Hold': {
    abbr: 'GOP',
    bg: 'bg-[#9A3412]',
    text: 'text-white',
    border: 'border-[#7C2D12]',
  },
};

export function USStateTileMap({
  benchmarkMode,
  onChangeBenchmarkMode,
  nationalAvgShift,
  demographicShifts = DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS,
  factionOverrides = {},
  selectedStateCode,
  onSelectState,
}: USStateTileMapProps) {
  const [metricMode, setMetricMode] = useState<MapMetricMode>('shift');
  const [officeFilter, setOfficeFilter] = useState<OfficeFilter>('all');

  const racesByState = useMemo(() => {
    const map = new Map<string, StatewideRace[]>();
    for (const race of STATEWIDE_RACES_2026) {
      if (officeFilter !== 'all' && race.office !== officeFilter) continue;
      const existing = map.get(race.stateCode) ?? [];
      existing.push(race);
      map.set(race.stateCode, existing);
    }
    return map;
  }, [officeFilter]);

  const activeRaces = useMemo(() => {
    if (officeFilter === 'all') return STATEWIDE_RACES_2026;
    return STATEWIDE_RACES_2026.filter((r) => r.office === officeFilter);
  }, [officeFilter]);

  const combinedByRaceId = useMemo(() => {
    const metrics = computeCombinedAdjustedMetrics(
      RAW_RACES_2026,
      demographicShifts,
      benchmarkMode
    );
    return new Map(metrics.map((m) => [m.race.id, m]));
  }, [demographicShifts, benchmarkMode]);

  const filteredAvgShift = useMemo(() => {
    if (activeRaces.length === 0) return nationalAvgShift;
    if (benchmarkMode === 'weighted') {
      const totalV = activeRaces.reduce((s, r) => s + r.votesMillions, 0);
      return Number(
        (activeRaces.reduce((s, r) => s + calculateRaceShift(r) * r.votesMillions, 0) / totalV).toFixed(2)
      );
    }
    return Number(
      (activeRaces.reduce((s, r) => s + calculateRaceShift(r), 0) / activeRaces.length).toFixed(2)
    );
  }, [activeRaces, benchmarkMode, nationalAvgShift]);

  const selectedTile = STATE_TILES.find((t) => t.code === selectedStateCode) ?? STATE_TILES[0];
  const selectedRaces = racesByState.get(selectedStateCode) ?? [];

  function getRepresentativeRace(code: string): StatewideRace | null {
    const list = racesByState.get(code);
    if (!list || list.length === 0) return null;
    // Prefer flipped or Senate race when showing combined single tile summary
    return list.find((r) => r.flipped) ?? list[0];
  }

  function getTileVisual(code: string): {
    bgClass: string;
    textClass: string;
    borderClass: string;
    subLabel: string;
  } {
    const race = getRepresentativeRace(code);
    if (!race) {
      return {
        bgClass: 'bg-[#EDEAE2]',
        textClass: 'text-stone-400',
        borderClass: 'border-stone-300/70',
        subLabel: '—',
      };
    }

    const shift = calculateRaceShift(race);
    const metrics = combinedByRaceId.get(race.id);
    const meanAdj = metrics?.afterMeanResidual ?? 0;
    const logitAdj = metrics?.logitAdjustedResidual ?? 0;
    const demoAdj = metrics?.adjustedDifference ?? 0;

    if (metricMode === 'shift') {
      if (shift >= 20) {
        return {
          bgClass: 'bg-[#172554]',
          textClass: 'text-white',
          borderClass: 'border-[#172554]',
          subLabel: formatSignedMargin(shift),
        };
      }
      if (shift >= 12) {
        return {
          bgClass: 'bg-[#1E3A8A]',
          textClass: 'text-white',
          borderClass: 'border-[#1E3A8A]',
          subLabel: formatSignedMargin(shift),
        };
      }
      if (shift >= 5) {
        return {
          bgClass: 'bg-[#3B82F6]',
          textClass: 'text-white',
          borderClass: 'border-[#2563EB]',
          subLabel: formatSignedMargin(shift),
        };
      }
      if (shift >= 0) {
        return {
          bgClass: 'bg-[#DBEAFE]',
          textClass: 'text-[#1E3A8A]',
          borderClass: 'border-[#93C5FD]',
          subLabel: formatSignedMargin(shift),
        };
      }
      return {
        bgClass: 'bg-[#FDE68A]',
        textClass: 'text-stone-900',
        borderClass: 'border-[#F59E0B]',
        subLabel: formatSignedMargin(shift),
      };
    }

    if (
      metricMode === 'meanAdjusted' ||
      metricMode === 'logitAdjusted' ||
      metricMode === 'overperformance'
    ) {
      const residual =
        metricMode === 'meanAdjusted'
          ? meanAdj
          : metricMode === 'logitAdjusted'
          ? logitAdj
          : demoAdj;
      if (residual >= 5) {
        return {
          bgClass: 'bg-[#1E3A8A]',
          textClass: 'text-white',
          borderClass: 'border-[#172554]',
          subLabel: formatSignedMargin(residual),
        };
      }
      if (residual >= 0.5) {
        return {
          bgClass: 'bg-[#93C5FD]',
          textClass: 'text-[#172554]',
          borderClass: 'border-[#60A5FA]',
          subLabel: formatSignedMargin(residual),
        };
      }
      if (residual > -3) {
        return {
          bgClass: 'bg-[#E7E5E4]',
          textClass: 'text-stone-800',
          borderClass: 'border-stone-300',
          subLabel: formatSignedMargin(residual),
        };
      }
      return {
        bgClass: 'bg-[#FDBA74]',
        textClass: 'text-[#7C2D12]',
        borderClass: 'border-[#EA580C]',
        subLabel: formatSignedMargin(residual),
      };
    }

    if (metricMode === 'margin') {
      const m = race.demOrCoalitionMargin2026;
      if (race.winnerParty === 'R') {
        return {
          bgClass: Math.abs(m) > 12 ? 'bg-[#9A3412]' : 'bg-[#EA580C]',
          textClass: 'text-white',
          borderClass: 'border-[#7C2D12]',
          subLabel: formatPartyMargin(m),
        };
      }
      if (m >= 15) {
        return {
          bgClass: 'bg-[#172554]',
          textClass: 'text-white',
          borderClass: 'border-[#172554]',
          subLabel: formatPartyMargin(m),
        };
      }
      if (m >= 6) {
        return {
          bgClass: 'bg-[#1E3A8A]',
          textClass: 'text-white',
          borderClass: 'border-[#1E3A8A]',
          subLabel: formatPartyMargin(m),
        };
      }
      return {
        bgClass: 'bg-[#3B82F6]',
        textClass: 'text-white',
        borderClass: 'border-[#2563EB]',
        subLabel: formatPartyMargin(m),
      };
    }

    // Faction mode
    const effectiveFaction = factionOverrides[race.id] ?? race.faction;
    const style = FACTION_SHORT[effectiveFaction] ?? FACTION_SHORT['Pragmatic Center-Left'];
    return {
      bgClass: style.bg,
      textClass: style.text,
      borderClass: style.border,
      subLabel: style.abbr,
    };
  }

  return (
    <section id="state-map" className="py-12 border-t border-stone-200 scroll-mt-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
            01 · Setting the Baseline · From 2024 to 2026
          </p>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-stone-900 mt-1">
            First, Putting Every State on the Same Starting Line
          </h2>
          <p className="text-sm text-stone-600 mt-2 max-w-2xl">
            Anchor all {STATEWIDE_RACES_2026.length} Senate and Governor contests to 2024
            presidential baselines. Switch metrics or click any state to inspect its local story.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <div className="inline-flex items-center p-1 bg-[#EFECE5] border border-stone-200 rounded-md">
            {(['all', 'Senate', 'Governor'] as OfficeFilter[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setOfficeFilter(opt)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  officeFilter === opt
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {opt === 'all' ? 'All Contested' : opt}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center p-1 bg-[#EFECE5] border border-stone-200 rounded-md">
            {(
              [
                { id: 'unweighted', label: 'State Mean' },
                { id: 'weighted', label: 'Vote-Weighted' },
              ] as { id: BenchmarkMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeBenchmarkMode(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  benchmarkMode === opt.id
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric View Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-stone-200">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EFECE5] border border-stone-200 rounded-md">
          {(
            [
              { id: 'shift', label: 'Raw Diff. vs. 2024' },
              { id: 'meanAdjusted', label: 'Mean-Adjusted' },
              { id: 'logitAdjusted', label: 'Logit-Adj. (Potential Gain)' },
              { id: 'overperformance', label: 'Demo-Adjusted' },
              { id: 'margin', label: '2026 Margin' },
              { id: 'faction', label: 'Affiliation' },
            ] as { id: MapMetricMode; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMetricMode(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                metricMode === tab.id
                  ? 'bg-stone-900 text-[#FBF9F5]'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-stone-600 font-mono tabular-nums">
          Active Benchmark ({officeFilter === 'all' ? 'Sen + Gov' : officeFilter},{' '}
          {benchmarkMode === 'unweighted' ? 'Unweighted' : 'Vote-Weighted'}):{' '}
          <span className="font-semibold text-[#1E3A8A]">+{filteredAvgShift.toFixed(1)} pts D</span>
        </div>
      </div>

      {/* Main Split: 12-Col Tile Cartogram + State Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 bg-[#F5F2EB] border border-stone-200 rounded-lg p-4 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="overflow-x-auto pb-2">
              <div
                className="grid gap-1.5 min-w-[540px]"
                style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}
                role="grid"
                aria-label="United States 2026 Midterm Electoral Shift Tile Map"
              >
                {STATE_TILES.map((tile) => {
                  const visual = getTileVisual(tile.code);
                  const isSelected = tile.code === selectedStateCode;
                  const races = racesByState.get(tile.code) ?? [];
                  const hasFlip = races.some((r) => r.flipped);

                  return (
                    <button
                      key={tile.code}
                      type="button"
                      onClick={() => onSelectState(tile.code)}
                      style={{
                        gridColumnStart: tile.col + 1,
                        gridRowStart: tile.row + 1,
                      }}
                      aria-label={`${tile.name}: ${
                        races.length > 0 ? visual.subLabel : 'No contested race in filter'
                      }`}
                      aria-pressed={isSelected}
                      className={`relative aspect-square rounded border flex flex-col items-center justify-center p-0.5 transition-transform duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
                        visual.bgClass
                      } ${visual.textClass} ${visual.borderClass} ${
                        isSelected
                          ? 'ring-2 ring-stone-900 ring-offset-2 ring-offset-[#F5F2EB] scale-105 z-10'
                          : 'hover:scale-105 hover:z-10'
                      }`}
                    >
                      <span className="text-[10px] sm:text-[11px] font-semibold leading-none tracking-tight">
                        {tile.code}
                      </span>
                      <span className="text-[9px] font-mono tabular-nums leading-tight mt-0.5 opacity-90">
                        {visual.subLabel}
                      </span>
                      {hasFlip && (
                        <span
                          aria-hidden="true"
                          title="Party Flip"
                          className="absolute top-0.5 right-0.5 text-[8px] font-mono font-bold leading-none opacity-95"
                        >
                          *
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Map Legend */}
          <div className="mt-5 pt-4 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600">
            {metricMode === 'shift' && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-stone-700">Shift to D/Coalition:</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#172554] inline-block" /> +20+ pts
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#1E3A8A] inline-block" /> +12–19.9
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#3B82F6] inline-block" /> +5–11.9
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#DBEAFE] border border-[#93C5FD] inline-block" /> 0–4.9
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#EDEAE2] border border-stone-300 inline-block" /> No race
                </span>
              </div>
            )}
            {(metricMode === 'overperformance' ||
              metricMode === 'meanAdjusted' ||
              metricMode === 'logitAdjusted') && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-stone-700">
                  {metricMode === 'meanAdjusted'
                    ? 'Mean-Adjusted Diff.:'
                    : metricMode === 'logitAdjusted'
                    ? 'Logit-Adjusted Diff.:'
                    : 'Demo-Adjusted Diff.:'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#1E3A8A] inline-block" /> +5+ over
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#93C5FD] inline-block" /> +0.5 to +4.9
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#E7E5E4] border border-stone-300 inline-block" /> Near 0
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#FDBA74] inline-block" /> Below (-3+)
                </span>
              </div>
            )}
            {metricMode === 'margin' && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-stone-700">2026 Result:</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#172554] inline-block" /> Safe D (15+)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#3B82F6] inline-block" /> Flip / Close D
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#EA580C] inline-block" /> Close R
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#9A3412] inline-block" /> Solid R (12+)
                </span>
              </div>
            )}
            {metricMode === 'faction' && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#1E3A8A] inline-block" /> CTR: Center-Left
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#0F766E] inline-block" /> POP: Econ Populist
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#4338CA] inline-block" /> PRG: Progressive
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#92400E] inline-block" /> IND: Independent
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#9A3412] inline-block" /> GOP: GOP Hold
                </span>
              </div>
            )}
            <span className="font-mono text-[11px] text-stone-500">* = Seat flipped party in 2026</span>
          </div>
        </div>

        {/* Right: State Dossier Card */}
        <aside className="lg:col-span-5 bg-white border border-stone-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-baseline justify-between gap-4 pb-4 border-b border-stone-200">
              <div>
                <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
                  {selectedTile.region} · State Dossier
                </p>
                <h3 className="text-2xl font-display font-semibold text-stone-900 mt-0.5">
                  {selectedTile.name} ({selectedTile.code})
                </h3>
              </div>
              <div className="text-right shrink-0">
                <span className="block text-[11px] uppercase tracking-wider text-stone-500">
                  2024 Pres. Baseline
                </span>
                <span
                  className={`font-mono text-sm font-semibold tabular-nums ${
                    selectedTile.presMargin2024 >= 0 ? 'text-[#1E3A8A]' : 'text-[#9A3412]'
                  }`}
                >
                  {formatPartyMargin(selectedTile.presMargin2024)}
                </span>
              </div>
            </div>

            {selectedRaces.length === 0 ? (
              <div className="py-10 text-sm text-stone-600 leading-relaxed">
                <p className="font-medium text-stone-800 mb-2">
                  No tracked {officeFilter === 'all' ? 'Senate or Governor' : officeFilter} contest in{' '}
                  {selectedTile.name}
                </p>
                <p>
                  {selectedTile.nonContestedNote ??
                    'Try switching the chamber filter above to inspect other contests, or click a shaded state tile such as TX, IA, PA, NC, SC, KS, OH, MI, or FL.'}
                </p>
                <div className="mt-6 pt-4 border-t border-stone-100">
                  <p className="text-xs uppercase tracking-wider text-stone-500 mb-2">
                    Quick-jump to pivotal 2026 states
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['TX', 'IA', 'NC', 'SC', 'KS', 'PA', 'OH', 'MI', 'FL', 'NE'].map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => onSelectState(code)}
                        className="px-2.5 py-1 text-xs font-mono font-medium border border-stone-200 rounded hover:border-stone-400 hover:bg-stone-50 text-stone-800 transition-colors cursor-pointer"
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-stone-200">
                {selectedRaces.map((race) => {
                  const shift = calculateRaceShift(race);
                  const metrics = combinedByRaceId.get(race.id);
                  const meanAdj = metrics?.afterMeanResidual ?? 0;
                  const logitAdj = metrics?.logitAdjustedResidual ?? 0;
                  const demoAdj = metrics?.adjustedDifference ?? 0;

                  return (
                    <div key={race.id} className="py-5 first:pt-4 last:pb-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-stone-500 mb-1.5">
                        <span className="font-medium text-stone-700">{race.raceLabel}</span>
                        <span>
                          {race.flipped ? 'Seat Flipped Party' : `${race.winnerParty} Hold`} ·{' '}
                          {factionOverrides[race.id] ?? race.faction}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-base font-semibold text-stone-900">
                          {race.winnerName} ({race.winnerParty}) {race.winnerShare.toFixed(1)}%
                        </p>
                        <p className="text-xs text-stone-600 font-mono tabular-nums">
                          vs. {race.challengerName} ({race.challengerParty}) {race.challengerShare.toFixed(1)}%
                        </p>
                      </div>

                      {/* 5-metric quantitative strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-3 p-3 bg-[#F7F4EE] border border-stone-200/80 rounded">
                        <div>
                          <span className="block text-[11px] text-stone-500">2026 Margin</span>
                          <span
                            className={`font-mono text-sm font-semibold tabular-nums ${
                              race.demOrCoalitionMargin2026 >= 0 ? 'text-[#1E3A8A]' : 'text-[#9A3412]'
                            }`}
                          >
                            {formatPartyMargin(race.demOrCoalitionMargin2026)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-stone-500">Raw Diff.</span>
                          <span className="font-mono text-sm font-semibold tabular-nums text-[#1E3A8A]">
                            {formatSignedMargin(shift)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-stone-500">Mean-Adj.</span>
                          <span
                            className={`font-mono text-sm font-semibold tabular-nums ${
                              meanAdj >= 0 ? 'text-stone-900' : 'text-[#9A3412]'
                            }`}
                          >
                            {formatSignedMargin(meanAdj)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-stone-500">Logit-Adj.</span>
                          <span
                            className={`font-mono text-sm font-semibold tabular-nums ${
                              logitAdj >= 0 ? 'text-[#4338CA]' : 'text-[#9A3412]'
                            }`}
                          >
                            {formatSignedMargin(logitAdj)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-stone-500">Demo-Adj.</span>
                          <span
                            className={`font-mono text-sm font-semibold tabular-nums ${
                              demoAdj >= 0 ? 'text-[#0F766E]' : 'text-[#9A3412]'
                            }`}
                          >
                            {formatSignedMargin(demoAdj)}
                          </span>
                        </div>
                      </div>

                      <p className="mt-3 text-sm text-stone-700 leading-relaxed">{race.summaryNote}</p>

                      <div className="mt-3 text-xs text-stone-600">
                        <span className="font-medium text-stone-800">Policy Stances: </span>
                        {race.policyPillars.join(' · ')}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-stone-500">
                        <span className="font-medium text-stone-600">Primary Sources:</span>
                        {resolveSourceLinks(race.sourceAttribution).map((src, idx, arr) => (
                          <span key={src.id} className="inline-flex items-center gap-2">
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#1E3A8A] hover:underline underline-offset-2"
                            >
                              {src.organization}
                            </a>
                            {idx < arr.length - 1 && <span aria-hidden="true">·</span>}
                          </span>
                        ))}
                        <span aria-hidden="true">·</span>
                        <a
                          href="#sources"
                          className="text-stone-600 hover:text-stone-900 underline underline-offset-2"
                        >
                          2024 NARA Baseline
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
            <span>Click any state tile on the map to update</span>
            <span className="font-mono tabular-nums">{activeRaces.length} races in view</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
