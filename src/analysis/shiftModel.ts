import {
  BenchmarkMode,
  FactionAggregate,
  FactionLane,
  LogitModelParams,
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

export function marginToTwoPartyShare(margin: number): number {
  return Math.min(0.995, Math.max(0.005, 0.5 + margin / 200));
}

export function twoPartyShareToMargin(share: number): number {
  return (share - 0.5) * 200;
}

export function logit(p: number): number {
  const clamped = Math.min(0.995, Math.max(0.005, p));
  return Math.log(clamped / (1 - clamped));
}

export function invLogit(l: number): number {
  return 1 / (1 + Math.exp(-l));
}

/**
 * Fits a potential-gain curve in log-odds space:
 *   logit(p_2026) = alpha + beta * logit(p_2024)
 * where p = 0.5 + Margin / 200.
 * Captures both the national logit wave (alpha) and ceiling/floor compression (beta < 1).
 */
export function fitLogitShiftModel(
  races: StatewideRaceInput[],
  mode: BenchmarkMode = 'unweighted'
): LogitModelParams {
  if (races.length === 0) return { alpha: 0, beta: 1 };

  const weights = races.map((r) => (mode === 'weighted' ? r.votesMillions : 1));
  const wSum = weights.reduce((s, w) => s + w, 0);
  if (wSum === 0) return { alpha: 0, beta: 1 };

  const xs = races.map((r) => logit(marginToTwoPartyShare(r.presMargin2024)));
  const ys = races.map((r) => logit(marginToTwoPartyShare(r.demOrCoalitionMargin2026)));

  const meanX = xs.reduce((s, x, i) => s + weights[i] * x, 0) / wSum;
  const meanY = ys.reduce((s, y, i) => s + weights[i] * y, 0) / wSum;

  const cov = xs.reduce((s, x, i) => s + weights[i] * (x - meanX) * (ys[i] - meanY), 0);
  const varX = xs.reduce((s, x, i) => s + weights[i] * (x - meanX) ** 2, 0);

  const beta = varX > 0 ? cov / varX : 1;
  const alpha = meanY - beta * meanX;

  return {
    alpha: Number(alpha.toFixed(4)),
    beta: Number(beta.toFixed(4)),
  };
}

export function predictLogitExpectedMargin(
  presMargin2024: number,
  params: LogitModelParams
): number {
  const l24 = logit(marginToTwoPartyShare(presMargin2024));
  const expectedShare = invLogit(params.alpha + params.beta * l24);
  return twoPartyShareToMargin(expectedShare);
}

export function computeLogitPotentialMetrics(
  races: StatewideRaceInput[],
  mode: BenchmarkMode = 'unweighted'
): {
  params: LogitModelParams;
  byRaceId: Map<
    string,
    {
      expectedMargin2026: number;
      expectedShift: number;
      logitAdjustedResidual: number;
    }
  >;
} {
  const params = fitLogitShiftModel(races, mode);
  const byRaceId = new Map<
    string,
    {
      expectedMargin2026: number;
      expectedShift: number;
      logitAdjustedResidual: number;
    }
  >();

  for (const race of races) {
    const expectedMargin2026 = predictLogitExpectedMargin(race.presMargin2024, params);
    const expectedShift = expectedMargin2026 - race.presMargin2024;
    const logitAdjustedResidual = race.demOrCoalitionMargin2026 - expectedMargin2026;
    byRaceId.set(race.id, {
      expectedMargin2026: Number(expectedMargin2026.toFixed(2)),
      expectedShift: Number(expectedShift.toFixed(2)),
      logitAdjustedResidual: Number(logitAdjustedResidual.toFixed(2)),
    });
  }

  return { params, byRaceId };
}

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
  combinedAdjustedByRaceId?: Map<string, number>,
  logitAdjustedByRaceId?: Map<string, number>
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
        avgLogitAdjustedResidual: 0,
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
    const avgLogitAdjustedResidual = Number(
      (
        matching.reduce(
          (s, r) =>
            s +
            (logitAdjustedByRaceId?.get(r.id) ??
              computeResidualOverperformance(r, benchmarkShift)),
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
      avgLogitAdjustedResidual,
      avgCombinedAdjustedResidual,
    };
  });
}

export function aggregateByPolicy(
  races: StatewideRaceInput[],
  benchmarkShift: number,
  pillars: PolicyPillar[] = ALL_POLICY_PILLARS,
  combinedAdjustedByRaceId?: Map<string, number>,
  logitAdjustedByRaceId?: Map<string, number>
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
        avgLogitAdjustedResidual: 0,
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
    const avgLogitAdjustedResidual = Number(
      (
        matching.reduce(
          (s, r) =>
            s +
            (logitAdjustedByRaceId?.get(r.id) ??
              computeResidualOverperformance(r, benchmarkShift)),
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
      avgLogitAdjustedResidual,
      avgCombinedAdjustedResidual,
      raceIds: matching.map((r) => r.id),
    };
  });
}
