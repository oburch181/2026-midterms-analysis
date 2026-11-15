export * from './types';
export * from './datasets';
export * from './shiftModel';
export * from './demographicModel';

import { DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS, RAW_RACES_2026 } from './datasets';
import {
  computeCombinedAdjustedMetrics,
  computeDemographicDecompositions,
  computeMeanPureDemographicShift,
} from './demographicModel';
import {
  aggregateByFaction,
  aggregateByPolicy,
  computeAllRaceMetrics,
  computeNationalAverageShift,
  fitLogitShiftModel,
} from './shiftModel';
import { BenchmarkMode, ElectionAnalysisReport, NationalDemographicShifts } from './types';

/**
 * Runs the complete open-source 2026 midterm analysis pipeline and returns a
 * reproducible, self-contained JSON report object.
 */
export function buildFullAnalysisReport(options?: {
  benchmarkMode?: BenchmarkMode;
  demographicShifts?: NationalDemographicShifts;
}): ElectionAnalysisReport {
  const benchmarkMode = options?.benchmarkMode ?? 'unweighted';
  const demographicShifts = options?.demographicShifts ?? DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS;

  const nationalAverageShift = computeNationalAverageShift(RAW_RACES_2026, benchmarkMode);
  const meanPureDemographicShift = computeMeanPureDemographicShift(
    RAW_RACES_2026,
    demographicShifts,
    benchmarkMode
  );
  const logitModelParams = fitLogitShiftModel(RAW_RACES_2026, benchmarkMode);
  const combinedAdjustedMetrics = computeCombinedAdjustedMetrics(
    RAW_RACES_2026,
    demographicShifts,
    benchmarkMode
  );
  const combinedMap = new Map(
    combinedAdjustedMetrics.map((m) => [m.race.id, m.adjustedDifference])
  );
  const logitMap = new Map(
    combinedAdjustedMetrics.map((m) => [m.race.id, m.logitAdjustedResidual])
  );

  return {
    generatedAt: new Date().toISOString(),
    benchmarkMode,
    raceCount: RAW_RACES_2026.length,
    nationalAverageShift,
    meanPureDemographicShift,
    logitModelParams,
    demographicShiftsUsed: demographicShifts,
    raceMetrics: computeAllRaceMetrics(RAW_RACES_2026, nationalAverageShift),
    combinedAdjustedMetrics,
    demographicDecompositions: computeDemographicDecompositions(
      RAW_RACES_2026,
      demographicShifts,
      benchmarkMode
    ),
    factionAggregates: aggregateByFaction(
      RAW_RACES_2026,
      nationalAverageShift,
      combinedMap,
      logitMap
    ),
    policyAggregates: aggregateByPolicy(
      RAW_RACES_2026,
      nationalAverageShift,
      undefined,
      combinedMap,
      logitMap
    ),
  };
}
