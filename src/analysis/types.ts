export type Region = 'Northeast' | 'Midwest' | 'South' | 'West';
export type OfficeType = 'Senate' | 'Governor';
export type PartyCode = 'D' | 'R' | 'I';
export type BenchmarkMode = 'unweighted' | 'weighted';

export type FactionLane =
  | 'Pragmatic Center-Left'
  | 'Economic Populist & Labor'
  | 'Progressive Reformer'
  | 'Independent Populist'
  | 'GOP Resilience Hold';

export type PolicyPillar =
  | 'Cost of Living & Inflation'
  | 'Healthcare & Medicaid'
  | 'Public Education & Anti-Voucher'
  | 'Labor & Anti-Monopoly'
  | 'Anti-Corruption & Accountability'
  | 'Reproductive Freedom'
  | 'Trade & Tariffs'
  | 'Permitting & Energy';

export interface StatewideRaceInput {
  id: string;
  stateCode: string;
  stateName: string;
  region: Region;
  office: OfficeType;
  raceLabel: string;
  /** 2024 Presidential margin (positive = Harris D+, negative = Trump R+) */
  presMargin2024: number;
  winnerName: string;
  winnerParty: PartyCode;
  winnerShare: number;
  challengerName: string;
  challengerParty: PartyCode;
  challengerShare: number;
  /** 2026 Democratic or Non-GOP Coalition margin (positive = D/Coalition lead, negative = R lead) */
  demOrCoalitionMargin2026: number;
  flipped: boolean;
  featuredCandidate: string;
  featuredParty: PartyCode;
  faction: FactionLane;
  policyPillars: PolicyPillar[];
  /** Approximate total ballots cast in millions */
  votesMillions: number;
}

/**
 * Citizen Voting-Age Population (CVAP) shares in percent (0-100)
 * Derived from Pew Research Center / U.S. Census Bureau ACS analyses.
 */
export interface StateDemographicProfile {
  stateCode: string;
  white: number;
  hispanic: number;
  black: number;
  asian: number;
  other: number;
}

/**
 * National 2026-vs-2024 partisan shift (in percentage points toward Democrats)
 * for each demographic group, grounded in SSRS Voter Poll, AP VoteCast, NYT & UCLA LPPI.
 */
export interface NationalDemographicShifts {
  white: number;
  hispanic: number;
  black: number;
  asian: number;
  other: number;
}

export interface RaceShiftMetrics {
  race: StatewideRaceInput;
  rawShift: number;
  residualVsNational: number;
}

export interface DemographicDecomposition {
  race: StatewideRaceInput;
  profile: StateDemographicProfile;
  actualShift: number;
  /** Pure compositional shift predicted by national group swings: sum(w_g * delta_g) */
  pureDemographicShift: number;
  /** How much this state's demographics push it above/below the mean tracked state */
  demographicTiltVsMean: number;
  /** Statewide-scaled benchmark: national statewide avg + demographicTiltVsMean */
  adjustedDemographicBenchmark: number;
  /** Actual shift minus adjusted demographic benchmark (candidate/local residual) */
  residualVsDemographics: number;
  /** Share of actual shift attributable to pure demographic composition vs. statewide/candidate factors */
  pureDemographicSharePct: number;
}

export interface CombinedAdjustedMetrics {
  race: StatewideRaceInput;
  profile: StateDemographicProfile;
  rawShift: number;
  /** Weight 1: National mean tide across tracked races */
  meanWeight: number;
  /** Weight 2: State CVAP demographic tilt vs. tracked mean */
  demographicWeight: number;
  /** Pure demographic compositional shift expected before national mean scaling */
  pureDemographicShift: number;
  /** Total expected shift combining national mean tide + demographic tilt */
  adjustedDemographicBenchmark: number;
  /** Residual after subtracting only the national mean tide */
  afterMeanResidual: number;
  /** Final Demographic-Adjusted Difference: Raw Shift − (National Mean + Demographic Tilt) */
  adjustedDifference: number;
}

export interface FactionAggregate {
  faction: FactionLane;
  count: number;
  flips: number;
  avgBaseline2024: number;
  avgShift: number;
  avgResidual: number;
  avgCombinedAdjustedResidual: number;
}

export interface PolicyAggregate {
  pillar: PolicyPillar;
  count: number;
  flips: number;
  avgShift: number;
  avgResidual: number;
  avgCombinedAdjustedResidual: number;
  raceIds: string[];
}

export interface ElectionAnalysisReport {
  generatedAt: string;
  benchmarkMode: BenchmarkMode;
  raceCount: number;
  nationalAverageShift: number;
  meanPureDemographicShift: number;
  demographicShiftsUsed: NationalDemographicShifts;
  raceMetrics: RaceShiftMetrics[];
  combinedAdjustedMetrics: CombinedAdjustedMetrics[];
  demographicDecompositions: DemographicDecomposition[];
  factionAggregates: FactionAggregate[];
  policyAggregates: PolicyAggregate[];
}
