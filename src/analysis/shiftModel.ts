import {
  BenchmarkMode,
  FactionAggregate,
  FactionLane,
  PolicyAggregate,
  PolicyPillar,
  RaceShiftMetrics,
  StatewideRaceInput,
} from './types';

export const ALL_FACTIONS: FactionLane[] = [
  'Pragmatic Center-Left',
  'Economic Populist & Labor',
  'Progressive Reformer',
  'Independent Populist',
  'GOP Resilience Hold',
];

export const ALL_POLICY_PILLARS: PolicyPillar[] = [
  'Cost of Living & Inflation',
  'Healthcare & Medicaid',
  'Public Education & Anti-Voucher',
  'Labor & Anti-Monopoly',
  'Anti-Corruption & Accountability',
  'Reproductive Freedom',
  'Trade & Tariffs',
  'Permitting & Energy',
];

/**
 * Computes raw partisan shift (in percentage points toward Democrats / non-GOP coalition)
 * relative to the certified 2024 presidential margin in the same state:
 *   Shift = Margin_2026 - Margin_2024_Pres
 */
export function computeRaceShift(race: StatewideRaceInput): number {
  return Number((race.demOrCoalitionMargin2026 - race.presMargin2024).toFixed(2));
}

/**
 * Computes the national average shift across a set of statewide contests,
 * supporting either equal state weighting or 2026 ballot-cast weighting.
 */
export function computeNationalAverageShift(
  races: StatewideRaceInput[],
  mode: BenchmarkMode = 'unweighted'
): number {
  if (races.length === 0) return 0;
  if (mode === 'weighted') {
    const totalVotes = races.reduce((sum, r) => sum + r.votesMillions, 0);
    if (totalVotes === 0) return 0;
    const weightedSum = races.reduce(
      (sum, r) => sum + computeRaceShift(r) * r.votesMillions,
      0
    );
    return Number((weightedSum / totalVotes).toFixed(2));
  }
  const sum = races.reduce((acc, r) => acc + computeRaceShift(r), 0);
  return Number((sum / races.length).toFixed(2));
}

/**
 * Computes residual overperformance (or underperformance) relative to the national benchmark:
 *   Residual = Shift_race - Benchmark_Shift
 */
export function computeResidualOverperformance(
  race: StatewideRaceInput,
  benchmarkShift: number
): number {
  return Number((computeRaceShift(race) - benchmarkShift).toFixed(2));
}

export function computeAllRaceMetrics(
  races: StatewideRaceInput[],
  benchmarkShift: number
): RaceShiftMetrics[] {
  return races.map((race) => ({
    race,
    rawShift: computeRaceShift(race),
    residualVsNational: computeResidualOverperformance(race, benchmarkShift),
  }));
}

export function aggregateByFaction(
  races: StatewideRaceInput[],
  benchmarkShift: number,
  combinedAdjustedByRaceId?: Map<string, number>
): FactionAggregate[] {
  return ALL_FACTIONS.map((faction) => {
    const matching = races.filter((r) => r.faction === faction);
    const count = matching.length;
    const flips = matching.filter((r) => r.flipped).length;

    if (count === 0) {
      return {
        faction,
        count: 0,
        flips: 0,
        avgBaseline2024: 0,
        avgShift: 0,
        avgResidual: 0,
        avgCombinedAdjustedResidual: 0,
      };
    }

    const avgBaseline2024 = Number(
      (matching.reduce((s, r) => s + r.presMargin2024, 0) / count).toFixed(2)
    );
    const avgShift = Number(
      (matching.reduce((s, r) => s + computeRaceShift(r), 0) / count).toFixed(2)
    );
    const avgResidual = Number(
      (
        matching.reduce(
          (s, r) => s + computeResidualOverperformance(r, benchmarkShift),
          0
        ) / count
      ).toFixed(2)
    );
    const avgCombinedAdjustedResidual = Number(
      (
        matching.reduce(
          (s, r) =>
            s +
            (combinedAdjustedByRaceId?.get(r.id) ??
              computeResidualOverperformance(r, benchmarkShift)),
          0
        ) / count
      ).toFixed(2)
    );

    return {
      faction,
      count,
      flips,
      avgBaseline2024,
      avgShift,
      avgResidual,
      avgCombinedAdjustedResidual,
    };
  });
}

export function aggregateByPolicy(
  races: StatewideRaceInput[],
  benchmarkShift: number,
  pillars: PolicyPillar[] = ALL_POLICY_PILLARS,
  combinedAdjustedByRaceId?: Map<string, number>
): PolicyAggregate[] {
  return pillars.map((pillar) => {
    const matching = races.filter((r) => r.policyPillars.includes(pillar));
    const count = matching.length;
    const flips = matching.filter((r) => r.flipped).length;

    if (count === 0) {
      return {
        pillar,
        count: 0,
        flips: 0,
        avgShift: 0,
        avgResidual: 0,
        avgCombinedAdjustedResidual: 0,
        raceIds: [],
      };
    }

    const avgShift = Number(
      (matching.reduce((s, r) => s + computeRaceShift(r), 0) / count).toFixed(2)
    );
    const avgResidual = Number(
      (
        matching.reduce(
          (s, r) => s + computeResidualOverperformance(r, benchmarkShift),
          0
        ) / count
      ).toFixed(2)
    );
    const avgCombinedAdjustedResidual = Number(
      (
        matching.reduce(
          (s, r) =>
            s +
            (combinedAdjustedByRaceId?.get(r.id) ??
              computeResidualOverperformance(r, benchmarkShift)),
          0
        ) / count
      ).toFixed(2)
    );

    return {
      pillar,
      count,
      flips,
      avgShift,
      avgResidual,
      avgCombinedAdjustedResidual,
      raceIds: matching.map((r) => r.id),
    };
  });
}
