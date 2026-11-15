import { DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS, STATE_CVAP_DEMOGRAPHICS } from './datasets';
import { computeNationalAverageShift, computeRaceShift } from './shiftModel';
import {
  BenchmarkMode,
  CombinedAdjustedMetrics,
  DemographicDecomposition,
  NationalDemographicShifts,
  StateDemographicProfile,
  StatewideRaceInput,
} from './types';

/**
 * Computes the pure demographic compositional shift expected for a state given
 * national demographic group swings and the state's Citizen Voting-Age Population (CVAP) shares:
 *
 *   PureDemoShift(s) = sum_g [ (CVAP_share(s, g) / 100) * NationalGroupShift(g) ]
 */
export function computePureDemographicShift(
  profile: StateDemographicProfile,
  shifts: NationalDemographicShifts = DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS
): number {
  const raw =
    (profile.white / 100) * shifts.white +
    (profile.hispanic / 100) * shifts.hispanic +
    (profile.black / 100) * shifts.black +
    (profile.asian / 100) * shifts.asian +
    (profile.other / 100) * shifts.other;

  return Number(raw.toFixed(2));
}

/**
 * Computes the mean pure demographic shift across a list of races, using either
 * unweighted state parity or 2026 ballot weighting.
 */
export function computeMeanPureDemographicShift(
  races: StatewideRaceInput[],
  shifts: NationalDemographicShifts = DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS,
  mode: BenchmarkMode = 'unweighted',
  profiles: Record<string, StateDemographicProfile> = STATE_CVAP_DEMOGRAPHICS
): number {
  if (races.length === 0) return 0;

  if (mode === 'weighted') {
    const totalVotes = races.reduce((s, r) => s + r.votesMillions, 0);
    if (totalVotes === 0) return 0;
    const sum = races.reduce((acc, r) => {
      const profile = profiles[r.stateCode];
      if (!profile) return acc;
      return acc + computePureDemographicShift(profile, shifts) * r.votesMillions;
    }, 0);
    return Number((sum / totalVotes).toFixed(2));
  }

  const valid = races.filter((r) => Boolean(profiles[r.stateCode]));
  if (valid.length === 0) return 0;
  const sum = valid.reduce(
    (acc, r) => acc + computePureDemographicShift(profiles[r.stateCode], shifts),
    0
  );
  return Number((sum / valid.length).toFixed(2));
}

/**
 * Decomposes each statewide contest into:
 *  1. Pure Demographic Shift (House-baseline compositional prediction from CVAP x national group swings)
 *  2. Demographic Tilt vs. Mean State (how much more/less the state shifts purely from its demographic mix)
 *  3. Adjusted Demographic Benchmark (statewide wave average + state demographic tilt)
 *  4. Candidate / Local Residual vs. Demographics (Actual Shift - Adjusted Demographic Benchmark)
 */
export function computeDemographicDecompositions(
  races: StatewideRaceInput[],
  shifts: NationalDemographicShifts = DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS,
  mode: BenchmarkMode = 'unweighted',
  profiles: Record<string, StateDemographicProfile> = STATE_CVAP_DEMOGRAPHICS
): DemographicDecomposition[] {
  const nationalStatewideAvg = computeNationalAverageShift(races, mode);
  const meanPureDemo = computeMeanPureDemographicShift(races, shifts, mode, profiles);

  return races
    .filter((r) => Boolean(profiles[r.stateCode]))
    .map((race) => {
      const profile = profiles[race.stateCode];
      const actualShift = computeRaceShift(race);
      const pureDemographicShift = computePureDemographicShift(profile, shifts);
      const demographicTiltVsMean = Number((pureDemographicShift - meanPureDemo).toFixed(2));
      const adjustedDemographicBenchmark = Number(
        (nationalStatewideAvg + demographicTiltVsMean).toFixed(2)
      );
      const residualVsDemographics = Number(
        (actualShift - adjustedDemographicBenchmark).toFixed(2)
      );
      const pureDemographicSharePct =
        actualShift > 0
          ? Number(Math.min(100, Math.max(0, (pureDemographicShift / actualShift) * 100)).toFixed(1))
          : 0;

      return {
        race,
        profile,
        actualShift,
        pureDemographicShift,
        demographicTiltVsMean,
        adjustedDemographicBenchmark,
        residualVsDemographics,
        pureDemographicSharePct,
      };
    });
}

/**
 * Computes the Demographic-Adjusted Difference by combining two structural weights:
 *  1. National Mean Tide (meanWeight)
 *  2. Demographic Composition Tilt (demographicWeight = PureDemo(s) - MeanPureDemo)
 *
 *   AdjustedDifference = RawShift - (meanWeight + demographicWeight)
 */
export function computeCombinedAdjustedMetrics(
  races: StatewideRaceInput[],
  shifts: NationalDemographicShifts = DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS,
  mode: BenchmarkMode = 'unweighted',
  profiles: Record<string, StateDemographicProfile> = STATE_CVAP_DEMOGRAPHICS
): CombinedAdjustedMetrics[] {
  const meanWeight = computeNationalAverageShift(races, mode);
  const meanPureDemo = computeMeanPureDemographicShift(races, shifts, mode, profiles);

  return races
    .filter((r) => Boolean(profiles[r.stateCode]))
    .map((race) => {
      const profile = profiles[race.stateCode];
      const rawShift = computeRaceShift(race);
      const pureDemographicShift = computePureDemographicShift(profile, shifts);
      const demographicWeight = Number((pureDemographicShift - meanPureDemo).toFixed(2));
      const adjustedDemographicBenchmark = Number((meanWeight + demographicWeight).toFixed(2));
      const afterMeanResidual = Number((rawShift - meanWeight).toFixed(2));
      const adjustedDifference = Number(
        (rawShift - adjustedDemographicBenchmark).toFixed(2)
      );

      return {
        race,
        profile,
        rawShift,
        meanWeight,
        demographicWeight,
        pureDemographicShift,
        adjustedDemographicBenchmark,
        afterMeanResidual,
        adjustedDifference,
      };
    });
}
