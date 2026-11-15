import { ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import editorialDeskHero from './assets/images/editorial_election_desk_1794672227514.jpg';
import { AffiliationPolicyAnalysis } from './components/AffiliationPolicyAnalysis';
import { DemographicStorySection } from './components/DemographicStorySection';
import { MethodologyModal } from './components/MethodologyModal';
import { OverperformanceChart } from './components/OverperformanceChart';
import { TopBar } from './components/TopBar';
import { USStateTileMap } from './components/USStateTileMap';
import {
  DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS,
  RAW_RACES_2026,
  aggregateByFaction,
  aggregateByPolicy,
  computeCombinedAdjustedMetrics,
} from './analysis';
import {
  BenchmarkMode,
  FactionLane,
  PRIMARY_DATA_SOURCES,
  STATEWIDE_RACES_2026,
  SourceCategory,
  calculateNationalAverageShift,
  formatSignedMargin,
} from './data/electionData';

type SummaryRankMetric = 'mean' | 'logit' | 'adjusted' | 'raw';

const SUMMARY_METRIC_OPTIONS: { id: SummaryRankMetric; label: string }[] = [
  { id: 'mean', label: 'Mean-Adj.' },
  { id: 'logit', label: 'Logit-Adj.' },
  { id: 'adjusted', label: 'Demo-Adj.' },
  { id: 'raw', label: 'Raw Diff.' },
];

export default function App() {
  const [benchmarkMode, setBenchmarkMode] = useState<BenchmarkMode>('unweighted');
  const demographicShifts = DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS;
  const [factionOverrides, setFactionOverrides] = useState<Record<string, FactionLane>>({});
  const [selectedStateCode, setSelectedStateCode] = useState<string>('TX');
  const [methodologyOpen, setMethodologyOpen] = useState<boolean>(false);
  const [heroImageError, setHeroImageError] = useState<boolean>(false);
  const [winnersSortMetric, setWinnersSortMetric] = useState<SummaryRankMetric>('mean');
  const [losersSortMetric, setLosersSortMetric] = useState<SummaryRankMetric>('logit');

  const defaultFactionById = useMemo(
    () => new Map(RAW_RACES_2026.map((r) => [r.id, r.faction])),
    []
  );

  function handleChangeFaction(raceId: string, nextFaction: FactionLane) {
    setFactionOverrides((prev) => {
      const updated = { ...prev };
      if (defaultFactionById.get(raceId) === nextFaction) {
        delete updated[raceId];
      } else {
        updated[raceId] = nextFaction;
      }
      return updated;
    });
  }

  function handleResetFactions() {
    setFactionOverrides({});
  }

  const effectiveRawRaces = useMemo(
    () =>
      RAW_RACES_2026.map((r) => ({
        ...r,
        faction: factionOverrides[r.id] ?? r.faction,
      })),
    [factionOverrides]
  );

  const unweightedAvg = useMemo(
    () => calculateNationalAverageShift(STATEWIDE_RACES_2026, 'unweighted'),
    []
  );
  const weightedAvg = useMemo(
    () => calculateNationalAverageShift(STATEWIDE_RACES_2026, 'weighted'),
    []
  );

  const activeNationalAvgShift = benchmarkMode === 'unweighted' ? unweightedAvg : weightedAvg;

  const flipCount = useMemo(
    () => STATEWIDE_RACES_2026.filter((r) => r.flipped).length,
    []
  );

  const combinedMetrics = useMemo(
    () => computeCombinedAdjustedMetrics(RAW_RACES_2026, demographicShifts, benchmarkMode),
    [demographicShifts, benchmarkMode]
  );

  const combinedMap = useMemo(
    () => new Map(combinedMetrics.map((m) => [m.race.id, m.adjustedDifference])),
    [combinedMetrics]
  );

  const logitMap = useMemo(
    () => new Map(combinedMetrics.map((m) => [m.race.id, m.logitAdjustedResidual])),
    [combinedMetrics]
  );

  const factionSummary = useMemo(
    () => aggregateByFaction(effectiveRawRaces, activeNationalAvgShift, combinedMap, logitMap),
    [effectiveRawRaces, activeNationalAvgShift, combinedMap, logitMap]
  );
  const ctrAgg = factionSummary.find((f) => f.faction === 'Pragmatic Center-Left');
  const popAgg = factionSummary.find((f) => f.faction === 'Economic Populist & Labor');
  const progAgg = factionSummary.find((f) => f.faction === 'Progressive Reformer');
  const indAgg = factionSummary.find((f) => f.faction === 'Independent Populist');

  const policySummary = useMemo(
    () => aggregateByPolicy(RAW_RACES_2026, activeNationalAvgShift, undefined, combinedMap, logitMap),
    [activeNationalAvgShift, combinedMap, logitMap]
  );
  const tradePolicy = policySummary.find((p) => p.pillar === 'Trade & Tariffs');
  const eduPolicy = policySummary.find((p) => p.pillar === 'Public Education & Anti-Voucher');
  const antiCorrPolicy = policySummary.find(
    (p) => p.pillar === 'Anti-Corruption & Accountability'
  );

  const txSenMetric = combinedMetrics.find((m) => m.race.id === 'TX-SEN');
  const txGovMetric = combinedMetrics.find((m) => m.race.id === 'TX-GOV');
  const iaGovMetric = combinedMetrics.find((m) => m.race.id === 'IA-GOV');
  const nmSenMetric = combinedMetrics.find((m) => m.race.id === 'NM-SEN');
  const caGovMetric = combinedMetrics.find((m) => m.race.id === 'CA-GOV');
  const wvSenMetric = combinedMetrics.find((m) => m.race.id === 'WV-SEN');
  const maSenMetric = combinedMetrics.find((m) => m.race.id === 'MA-SEN');
  const nyGovMetric = combinedMetrics.find((m) => m.race.id === 'NY-GOV');
  const okSenMetric = combinedMetrics.find((m) => m.race.id === 'OK-SEN');
  const paGovMetric = combinedMetrics.find((m) => m.race.id === 'PA-GOV');
  const ncSenMetric = combinedMetrics.find((m) => m.race.id === 'NC-SEN');
  const riSenMetric = combinedMetrics.find((m) => m.race.id === 'RI-SEN');

  const modelConvergence = useMemo(() => {
    const n = combinedMetrics.length;
    if (n === 0) return { r: 0, sameSignCount: 0, withinTwoCount: 0 };
    const meanVals = combinedMetrics.map((m) => m.afterMeanResidual);
    const demoVals = combinedMetrics.map((m) => m.adjustedDifference);
    const avgM = meanVals.reduce((s, v) => s + v, 0) / n;
    const avgD = demoVals.reduce((s, v) => s + v, 0) / n;
    const cov = meanVals.reduce((s, v, idx) => s + (v - avgM) * (demoVals[idx] - avgD), 0);
    const stdM = Math.sqrt(meanVals.reduce((s, v) => s + (v - avgM) ** 2, 0));
    const stdD = Math.sqrt(demoVals.reduce((s, v) => s + (v - avgD) ** 2, 0));
    const r = stdM > 0 && stdD > 0 ? cov / (stdM * stdD) : 0;
    const sameSignCount = combinedMetrics.filter(
      (m) => (m.afterMeanResidual >= 0) === (m.adjustedDifference >= 0)
    ).length;
    const withinTwoCount = combinedMetrics.filter(
      (m) => Math.abs(m.demographicWeight) <= 2.0
    ).length;
    return { r, sameSignCount, withinTwoCount };
  }, [combinedMetrics]);

  function getCombinedMetricValue(
    item: (typeof combinedMetrics)[number],
    metric: SummaryRankMetric
  ): number {
    if (metric === 'logit') return item.logitAdjustedResidual;
    if (metric === 'adjusted') return item.adjustedDifference;
    if (metric === 'raw') return item.rawShift;
    return item.afterMeanResidual;
  }

  const topOverperformers = useMemo(
    () =>
      [...combinedMetrics]
        .sort(
          (a, b) =>
            getCombinedMetricValue(b, winnersSortMetric) -
            getCombinedMetricValue(a, winnersSortMetric)
        )
        .slice(0, 5),
    [combinedMetrics, winnersSortMetric]
  );

  const widestUnderperformers = useMemo(
    () =>
      [...combinedMetrics]
        .sort(
          (a, b) =>
            getCombinedMetricValue(a, losersSortMetric) -
            getCombinedMetricValue(b, losersSortMetric)
        )
        .slice(0, 5),
    [combinedMetrics, losersSortMetric]
  );

  const laborPolicy = policySummary.find((p) => p.pillar === 'Labor & Anti-Monopoly');
  const costPolicy = policySummary.find((p) => p.pillar === 'Cost of Living & Inflation');

  return (
    <div id="top" className="min-h-screen bg-[#FBF9F5] text-[#1C1917]">
      <TopBar onOpenMethodology={() => setMethodologyOpen(true)} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        {/* Hero / Masthead Section */}
        <article className="pt-10 sm:pt-14 pb-10">
          <header className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 font-medium tracking-wide">
              <span>2026 Midterm Data Investigation</span>
              <span aria-hidden="true">·</span>
              <span>Published November 14, 2026</span>
              <span aria-hidden="true">·</span>
              <span>8 min read</span>
            </div>

            <h1 className="mt-4 text-3xl sm:text-5xl font-display font-semibold tracking-tight text-stone-900 leading-[1.12]">
              What Tuesday&apos;s Midterm Tsunami Tells Us About 2028
            </h1>

            <p className="mt-4 text-lg sm:text-xl font-serif text-stone-600 leading-relaxed max-w-3xl">
              A 15-point wave (+{unweightedAvg.toFixed(1)} state mean, +{weightedAvg.toFixed(1)}{' '}
              vote-weighted) flipped {flipCount} seats from Texas to Maine—lifting winners across
              every wing of the party. Drilling into differences highlights which candidates merely
              rode the wave and which ones were leading the charge.
            </p>
          </header>

          {/* Lead Documentary Photograph */}
          <figure className="mt-8">
            <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-[#EFECE5] aspect-[16/9] max-h-[480px] w-full">
              {!heroImageError ? (
                <img
                  src={editorialDeskHero}
                  alt="Editorial newsroom drafting table with printed United States electoral maps, brass dividers, and county turnout ledgers in morning window light"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImageError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#F2EFE9] to-[#E5E0D5]">
                  <p className="font-display text-2xl text-stone-700">The 2026 Electoral Archive</p>
                  <p className="text-xs text-stone-500 mt-1">
                    Statewide Precinct &amp; Margin Comparison Ledger
                  </p>
                </div>
              )}
            </div>
            <figcaption className="mt-2.5 text-xs font-serif italic text-stone-500">
              Fig. 1 — Comparing certified November 3, 2026 statewide results against the 2024
              presidential baseline highlights both pocketbook convergence and regional divergence.
            </figcaption>
          </figure>

          {/* 4-Column Quantitative KPI Strip */}
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 border-t border-b border-stone-200 divide-y lg:divide-y-0 lg:divide-x divide-stone-200 bg-[#F7F4EE]/60">
            <div className="p-5">
              <span className="block text-xs text-stone-500">Unweighted State Mean Shift</span>
              <span className="mt-1 block font-mono text-2xl font-semibold tabular-nums text-[#1E3A8A]">
                +{unweightedAvg.toFixed(1)} pts
              </span>
              <span className="mt-1 block text-[11px] text-stone-500">
                Across {STATEWIDE_RACES_2026.length} Senate &amp; Gov races
              </span>
            </div>

            <div className="p-5">
              <span className="block text-xs text-stone-500">Ballot-Weighted Mean Shift</span>
              <span className="mt-1 block font-mono text-2xl font-semibold tabular-nums text-[#1E3A8A]">
                +{weightedAvg.toFixed(1)} pts
              </span>
              <span className="mt-1 block text-[11px] text-stone-500">
                Weighted by 2026 votes cast
              </span>
            </div>

            <div className="p-5">
              <span className="block text-xs text-stone-500">Tracked Partisan Flips</span>
              <span className="mt-1 block font-mono text-2xl font-semibold tabular-nums text-stone-900">
                {flipCount} seats
              </span>
              <span className="mt-1 block text-[11px] text-stone-500">
                Includes TX, NC, SC, KS, IA, OH, AK, ME
              </span>
            </div>

            <div className="p-5">
              <span className="block text-xs text-stone-500">National House Popular Swing</span>
              <span className="mt-1 block font-mono text-2xl font-semibold tabular-nums text-stone-900">
                ~+8.5 pts
              </span>
              <span className="mt-1 block text-[11px] text-stone-500">
                2026 House vote vs. 2024 baseline (AP / Ballotpedia)
              </span>
            </div>
          </div>

          {/* Data-Level Questions & Narrative Approach */}
          <section id="thesis" className="mt-12 scroll-mt-24">
            <div className="mb-8 p-6 sm:p-8 bg-[#F5F2EB] border border-stone-200 rounded-lg">
              <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
                The Core Lens · Four Numbers That Matter
              </p>
              <h2 className="text-xl sm:text-2xl font-display font-semibold text-stone-900 mt-1">
                Separating Candidate Appeal From the Tide, Ceiling Room, and Demographics
              </h2>
              <p className="mt-2 text-sm text-stone-700 leading-relaxed max-w-3xl">
                To see what voters rewarded beyond the national wave, we track four numbers for
                every race—keeping <strong>Mean-Adjusted</strong> as our default benchmark:
              </p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="bg-white border border-stone-200 rounded p-4">
                  <p className="font-mono text-xs font-semibold text-[#1E3A8A]">
                    01 · Raw Diff. (2026 − 2024)
                  </p>
                  <p className="mt-1.5 text-stone-700 leading-relaxed text-xs sm:text-sm">
                    Full swing against 2024 presidential margins (averaging{' '}
                    <strong className="font-mono">+{unweightedAvg.toFixed(1)} pts</strong>).
                  </p>
                </div>

                <div className="bg-white border border-stone-300 rounded p-4">
                  <p className="font-mono text-xs font-semibold text-stone-900">
                    02 · Mean-Adjusted (Default)
                  </p>
                  <p className="mt-1.5 text-stone-700 leading-relaxed text-xs sm:text-sm">
                    Subtracts the national mean (<strong className="font-mono">+{unweightedAvg.toFixed(1)}</strong>{' '}
                    state / <strong className="font-mono">+{weightedAvg.toFixed(1)}</strong>{' '}
                    ballot-weighted) to isolate above-wave races.
                  </p>
                </div>

                <div className="bg-white border border-stone-200 rounded p-4">
                  <p className="font-mono text-xs font-semibold text-[#4338CA]">
                    03 · Logit-Adj. (Potential Gain)
                  </p>
                  <p className="mt-1.5 text-stone-700 leading-relaxed text-xs sm:text-sm">
                    Fits a log-odds curve (<code className="font-mono text-[11px]">L₂₆ = α + β·L₂₄</code>)
                    so safe-blue ceilings and deep-red floors aren&apos;t misscored.
                  </p>
                </div>

                <div className="bg-white border border-stone-200 rounded p-4">
                  <p className="font-mono text-xs font-semibold text-[#0F766E]">
                    04 · Demo-Adjusted (Tide + CVAP)
                  </p>
                  <p className="mt-1.5 text-stone-700 leading-relaxed text-xs sm:text-sm">
                    Removes the wave plus each state&apos;s{' '}
                    <strong>demographic CVAP tilt</strong>—separating candidate appeal from group
                    rebounds.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-8 prose-editorial space-y-5 max-w-2xl">
                <p className="first-letter:text-5xl first-letter:font-display first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-none first-letter:text-stone-900">
                  Tuesday&apos;s{' '}
                  <strong className="font-semibold text-stone-900">
                    +{unweightedAvg.toFixed(1)}-point
                  </strong>{' '}
                  wave lifted Democratic and coalition candidates across every ideological lane, from
                  winning centrists like <strong>Roy Cooper</strong>, <strong>Rob Sand</strong>, and{' '}
                  <strong>Josh Shapiro</strong> to economic populists like{' '}
                  <strong>James Talarico</strong> and <strong>Sherrod Brown</strong>, progressives
                  like <strong>Troy Jackson</strong> and <strong>Abdul El-Sayed</strong>, and
                  long-shot challengers such as <strong>Angie Nixon</strong>,{' '}
                  <strong>David Jolly</strong>, and independent <strong>Dan Osborn</strong>. When a
                  tsunami flips {flipCount} seats, every faction can claim credit. Looking at how
                  all{' '}
                  <a
                    href="#sources"
                    className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-4 text-stone-900"
                  >
                    <span className="font-mono text-sm tabular-nums">
                      {STATEWIDE_RACES_2026.length}
                    </span>{' '}
                    Senate and Governor contests
                  </a>{' '}
                  performed relative to that average—with live camp reassignment available in{' '}
                  <a
                    href="#affiliations"
                    className="text-[#1E3A8A] underline underline-offset-4 font-sans text-sm"
                  >
                    Section 03
                  </a>
                  —reveals which candidates and policies voters actually rewarded, and what lessons
                  Democrats can carry into 2028.
                </p>

                <p>
                  We look at <strong>Mean-Adjusted</strong> performance first simply because it is
                  the cleanest starting evaluation: subtract the{' '}
                  <strong className="font-mono">+{unweightedAvg.toFixed(1)}-point</strong>{' '}
                  national wave and see who beat the tide. But two competing hypotheses test
                  whether a flat national average still misses part of the picture:
                </p>

                <ol className="list-decimal pl-5 space-y-2.5 text-stone-800">
                  <li>
                    <strong>Can we separate demographic rebounds from candidate strength?</strong>{' '}
                    Exit polls from{' '}
                    <a
                      href="https://www.washingtonpost.com/elections/interactive/2026/exit-polls-results-demographics/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-4 italic"
                    >
                      The Washington Post
                    </a>
                    ,{' '}
                    <a
                      href="https://www.brookings.edu/articles/the-midterm-effect-what-the-2026-election-could-mean-for-public-policy/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-4 italic"
                    >
                      Brookings
                    </a>
                    , and{' '}
                    <a
                      href="https://latino.ucla.edu/research/four-ways-latinos-shaped-the-2026-midterms/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-4 italic"
                    >
                      UCLA LPPI
                    </a>{' '}
                    show Hispanic and working-class voters snapping back sharply—so{' '}
                    <strong>Demo-Adjusted</strong> strips out each state&apos;s CVAP composition to
                    isolate individual appeal.
                  </li>
                  <li>
                    <strong>How does potential ground gain change the story?</strong> Strangely
                    enough, a +20-point gain in California is far harder to achieve than a
                    +20-point gain in Texas because California already starts deeply Democratic and
                    has fewer non-blue voters left to persuade. Using a{' '}
                    <strong>Logit-Adjusted</strong> curve to account for that ceiling room shifts
                    who truly underperformed—especially in safe states.
                  </li>
                </ol>
              </div>

            {/* Right Margin Notes Rail */}
            <aside className="lg:col-span-4 space-y-6 text-sm">
              <div className="p-5 bg-[#F5F2EB] border border-stone-200 rounded-lg">
                <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
                  Context Note 01 · Safe States Shifted Too
                </p>
                <p className="mt-2 text-stone-700 leading-relaxed">
                  <a
                    href="https://www.cbsnews.com/news/2026-midterm-election-results-democrats-win-house-senate/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-2 font-medium"
                  >
                    CBS News
                  </a>{' '}
                  and{' '}
                  <a
                    href="https://www.multistate.us/elections/2026/results"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-2 font-medium"
                  >
                    MultiState
                  </a>{' '}
                  note that GOP Senate margins in West Virginia, Alabama, and Kentucky compressed by
                  19.4–21.5 pts vs. 2024 without flipping.
                </p>
              </div>

              <div className="p-5 bg-[#F5F2EB] border border-stone-200 rounded-lg">
                <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
                  Context Note 02 · Policy Signals Over Labels
                </p>
                <p className="mt-2 text-stone-700 leading-relaxed">
                  <a
                    href="https://www.americanprogress.org/article/working-class-voters-shifted-toward-democratic-and-independent-candidates-in-nearly-every-2026-senate-race/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-2 font-medium"
                  >
                    CAP
                  </a>{' '}
                  and{' '}
                  <a
                    href="https://www.brookings.edu/topics/2026-midterm-elections/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-2"
                  >
                    Brookings
                  </a>{' '}
                  show working-class and Latino rebounds across states—putting the focus on which
                  concrete policies outperformed that wave.
                </p>
              </div>

              <div className="p-5 bg-[#F5F2EB] border border-stone-200 rounded-lg">
                <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
                  Context Note 03 · Why House Races Are Excluded
                </p>
                <p className="mt-2 text-stone-700 leading-relaxed">
                  Unlike Senate and Governor elections held on fixed state borders, several U.S.
                  House districts were redrawn between 2024 and 2026—breaking the clean geographic
                  through-line needed to compare exact shifts against prior results.
                </p>
              </div>
            </aside>
            </div>
          </section>
        </article>

        {/* Interactive Section 1: US State Tile Cartogram */}
        <USStateTileMap
          benchmarkMode={benchmarkMode}
          onChangeBenchmarkMode={setBenchmarkMode}
          nationalAvgShift={activeNationalAvgShift}
          demographicShifts={demographicShifts}
          factionOverrides={factionOverrides}
          selectedStateCode={selectedStateCode}
          onSelectState={setSelectedStateCode}
        />

        {/* Interactive Section 2: Raw Shift vs Demographic-Adjusted Difference */}
        <OverperformanceChart
          benchmarkMode={benchmarkMode}
          nationalAvgShift={activeNationalAvgShift}
          demographicShifts={demographicShifts}
          factionOverrides={factionOverrides}
          selectedStateCode={selectedStateCode}
          onSelectState={setSelectedStateCode}
        />

        {/* Interactive Section 3: Affiliation Camps & Policy Pillars */}
        <AffiliationPolicyAnalysis
          benchmarkMode={benchmarkMode}
          nationalAvgShift={activeNationalAvgShift}
          demographicShifts={demographicShifts}
          factionOverrides={factionOverrides}
          onChangeFaction={handleChangeFaction}
          onResetFactions={handleResetFactions}
          onSelectState={setSelectedStateCode}
        />

        {/* Interactive Section 4: The Demographic Story */}
        <DemographicStorySection
          benchmarkMode={benchmarkMode}
          nationalAvgShift={activeNationalAvgShift}
          factionOverrides={factionOverrides}
          onSelectState={setSelectedStateCode}
        />

        {/* Section 5: Executive Data Summary */}
        <section id="outlook-2028" className="py-12 border-t border-stone-200 scroll-mt-20">
          <div className="mb-8 max-w-3xl">
            <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
              05 · Executive Summary · What the Data Shows
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-semibold text-stone-900 mt-1">
              The Bottom Line Across All {STATEWIDE_RACES_2026.length} Races
            </h2>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              Stepping back from individual race narratives, three empirical conclusions stand out
              across the certified margins, issue tags, and adjusted rankings.
            </p>
          </div>

          {/* 1. Mean-Adjusted vs. Demo-Adjusted Convergence */}
          <div className="p-6 bg-[#F5F2EB] border border-stone-200 rounded-lg mb-8">
            <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-stone-200">
              <div>
                <p className="font-mono text-xs font-semibold text-[#1E3A8A]">
                  Finding 01 · Mean-Adjusted vs. Demo-Adjusted Convergence
                </p>
                <h3 className="text-lg sm:text-xl font-display font-semibold text-stone-900 mt-1">
                  Demographic Weighting Mostly Confirms—Rather Than Rewrites—the Story
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-5 text-xs font-mono tabular-nums">
                <div>
                  <span className="block text-stone-500">Correlation (r)</span>
                  <span className="text-base font-semibold text-stone-900">
                    {modelConvergence.r.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="block text-stone-500">Same Direction</span>
                  <span className="text-base font-semibold text-stone-900">
                    {modelConvergence.sameSignCount}/{combinedMetrics.length} races
                  </span>
                </div>
                <div>
                  <span className="block text-stone-500">Within ±2.0 pts</span>
                  <span className="text-base font-semibold text-stone-900">
                    {modelConvergence.withinTwoCount}/{combinedMetrics.length} states
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-stone-700 leading-relaxed max-w-4xl">
              Once the <strong className="font-mono">+{activeNationalAvgShift.toFixed(1)} pt</strong>{' '}
              national tide is removed, adding CVAP demographics barely changes the ranking (
              <strong className="font-mono">r = {modelConvergence.r.toFixed(2)}</strong>):{' '}
              <strong className="font-mono">{modelConvergence.sameSignCount}</strong> of{' '}
              <strong className="font-mono">{combinedMetrics.length}</strong> races keep the same
              sign and <strong className="font-mono">{modelConvergence.withinTwoCount}</strong>{' '}
              shift by 2.0 points or less. The main exception is high-Latino rebounds—trimming{' '}
              <strong>Texas</strong> (Talarico{' '}
              <span className="font-mono">
                {formatSignedMargin(txSenMetric?.afterMeanResidual ?? 10.5)}
              </span>{' '}
              →{' '}
              <span className="font-mono">
                {formatSignedMargin(txSenMetric?.adjustedDifference ?? 5.2)}
              </span>
              ; Hinojosa{' '}
              <span className="font-mono">
                {formatSignedMargin(txGovMetric?.afterMeanResidual ?? 5.5)}
              </span>{' '}
              →{' '}
              <span className="font-mono">
                {formatSignedMargin(txGovMetric?.adjustedDifference ?? 0.2)}
              </span>
              ) and <strong>New Mexico</strong> (
              <span className="font-mono">
                {formatSignedMargin(nmSenMetric?.afterMeanResidual ?? 5.3)}
              </span>{' '}
              →{' '}
              <span className="font-mono">
                {formatSignedMargin(nmSenMetric?.adjustedDifference ?? -2.3)}
              </span>
              )—while crediting White-majority states like <strong>Iowa</strong> (
              <span className="font-mono">
                {formatSignedMargin(iaGovMetric?.afterMeanResidual ?? 9.0)}
              </span>{' '}
              →{' '}
              <span className="font-mono">
                {formatSignedMargin(iaGovMetric?.adjustedDifference ?? 11.1)}
              </span>
              ). Separately, our <strong>Logit-Adjusted (Potential Gain)</strong> curve adjusts for
              where states started—lifting safe-blue incumbents with limited ceiling room (
              <strong>MA-Sen</strong>{' '}
              <span className="font-mono">
                {formatSignedMargin(maSenMetric?.afterMeanResidual ?? -9.2)}
              </span>{' '}
              mean →{' '}
              <span className="font-mono text-[#4338CA]">
                {formatSignedMargin(maSenMetric?.logitAdjustedResidual ?? -3.1)}
              </span>{' '}
              logit; <strong>CA-Gov</strong>{' '}
              <span className="font-mono">
                {formatSignedMargin(caGovMetric?.afterMeanResidual ?? -4.3)}
              </span>{' '}
              →{' '}
              <span className="font-mono text-[#4338CA]">
                {formatSignedMargin(caGovMetric?.logitAdjustedResidual ?? 0.7)}
              </span>
              ; <strong>NY-Gov</strong>{' '}
              <span className="font-mono">
                {formatSignedMargin(nyGovMetric?.afterMeanResidual ?? -8.2)}
              </span>{' '}
              →{' '}
              <span className="font-mono text-[#4338CA]">
                {formatSignedMargin(nyGovMetric?.logitAdjustedResidual ?? -4.8)}
              </span>
              ) and trimming routine deep-red compression (<strong>WV-Sen</strong>{' '}
              <span className="font-mono">
                {formatSignedMargin(wvSenMetric?.afterMeanResidual ?? 6.2)}
              </span>{' '}
              →{' '}
              <span className="font-mono">
                {formatSignedMargin(wvSenMetric?.logitAdjustedResidual ?? 1.8)}
              </span>
              ; <strong>OK-Sen</strong>{' '}
              <span className="font-mono">
                {formatSignedMargin(okSenMetric?.afterMeanResidual ?? 1.7)}
              </span>{' '}
              →{' '}
              <span className="font-mono">
                {formatSignedMargin(okSenMetric?.logitAdjustedResidual ?? -2.2)}
              </span>
              ).
            </p>
          </div>

          {/* 2. What Resonated With Voters */}
          <div className="bg-white border border-stone-200 rounded-lg p-6 mb-8">
            <p className="font-mono text-xs font-semibold text-[#0F766E]">
              Finding 02 · Issue &amp; Coalition Resonance
            </p>
            <h3 className="text-lg sm:text-xl font-display font-semibold text-stone-900 mt-1">
              What Topics Actually Resonated With the Electorate
            </h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
              <div className="p-4 bg-[#F7F4EE] border border-stone-200 rounded">
                <p className="text-xs font-mono font-semibold text-[#0F766E]">
                  Top Performers · Concrete Pocketbook Relief
                </p>
                <p className="mt-2 text-xs sm:text-sm text-stone-700 leading-relaxed">
                  Voters most strongly rewarded tangible, local economic fights:{' '}
                  <strong>Trade &amp; Tariffs</strong> led every issue pillar (
                  <strong className="font-mono">
                    {formatSignedMargin(tradePolicy?.avgResidual ?? 4.4)}
                  </strong>{' '}
                  mean-adj. /{' '}
                  <span className="font-mono">
                    {formatSignedMargin(tradePolicy?.avgLogitAdjustedResidual ?? 3.1)}
                  </span>{' '}
                  logit, {tradePolicy?.flips ?? 4} flips in 5 races), followed by{' '}
                  <strong>Public Education &amp; Anti-Voucher</strong> (
                  <strong className="font-mono">
                    {formatSignedMargin(eduPolicy?.avgResidual ?? 2.1)}
                  </strong>
                  , {eduPolicy?.flips ?? 7} flips) and{' '}
                  <strong>Anti-Corruption &amp; Accountability</strong> (
                  <strong className="font-mono">
                    {formatSignedMargin(antiCorrPolicy?.avgResidual ?? 1.4)}
                  </strong>
                  ).
                </p>
              </div>

              <div className="p-4 bg-[#F7F4EE] border border-stone-200 rounded">
                <p className="text-xs font-mono font-semibold text-stone-800">
                  Baseline Theme · Broad Cost of Living
                </p>
                <p className="mt-2 text-xs sm:text-sm text-stone-700 leading-relaxed">
                  <strong>Cost of Living &amp; Inflation</strong> appeared in{' '}
                  <strong className="font-mono">{costPolicy?.count ?? 37}</strong> of{' '}
                  {STATEWIDE_RACES_2026.length} tracked campaigns and posted a near-baseline{' '}
                  <strong className="font-mono">
                    {formatSignedMargin(costPolicy?.avgResidual ?? 0.5)}
                  </strong>{' '}
                  mean-adj. average—serving as universal entry stakes across the map rather than a
                  separating advantage on its own.
                </p>
              </div>

              <div className="p-4 bg-[#F7F4EE] border border-stone-200 rounded">
                <p className="text-xs font-mono font-semibold text-[#9A3412]">
                  Lagged the Wave · Potential Gain Separates Camps
                </p>
                <p className="mt-2 text-xs sm:text-sm text-stone-700 leading-relaxed">
                  On Mean-Adjusted, <strong>Pragmatic Center-Left</strong> (
                  <strong className="font-mono">
                    {formatSignedMargin(ctrAgg?.avgResidual ?? 2.0)}
                  </strong>
                  ) and <strong>Economic Populist &amp; Labor</strong> (
                  <strong className="font-mono">
                    {formatSignedMargin(popAgg?.avgResidual ?? 2.0)}
                  </strong>
                  ) finish dead even—but <strong>Logit-Adjusted</strong> lifts Center-Left ahead (
                  <strong className="font-mono text-[#4338CA]">
                    {formatSignedMargin(ctrAgg?.avgLogitAdjustedResidual ?? 2.4)}
                  </strong>{' '}
                  vs.{' '}
                  <span className="font-mono">
                    {formatSignedMargin(popAgg?.avgLogitAdjustedResidual ?? 0.6)}
                  </span>
                  ). Meanwhile, <strong>Independent Populists</strong> (
                  <span className="font-mono">
                    {formatSignedMargin(indAgg?.avgResidual ?? -2.9)}
                  </span>{' '}
                  mean /{' '}
                  <span className="font-mono">
                    {formatSignedMargin(indAgg?.avgLogitAdjustedResidual ?? -5.8)}
                  </span>{' '}
                  logit), <strong>Labor &amp; Anti-Monopoly</strong> (
                  <span className="font-mono">
                    {formatSignedMargin(laborPolicy?.avgResidual ?? -3.5)}
                  </span>
                  ), and <strong>Progressive Reformers</strong> (
                  <span className="font-mono">
                    {formatSignedMargin(progAgg?.avgResidual ?? -6.8)}
                  </span>{' '}
                  mean /{' '}
                  <span className="font-mono">
                    {formatSignedMargin(progAgg?.avgLogitAdjustedResidual ?? -5.9)}
                  </span>{' '}
                  logit) trailed both benchmarks.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Biggest Winners & Biggest Losers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-stone-200 rounded-lg p-6 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs font-semibold text-[#0F766E]">
                    Finding 03 · Biggest Winners (
                    {SUMMARY_METRIC_OPTIONS.find((o) => o.id === winnersSortMetric)?.label})
                  </p>
                  <div
                    className="inline-flex items-center p-0.5 bg-[#EFECE5] border border-stone-200 rounded"
                    role="group"
                    aria-label="Sort Biggest Winners by metric"
                  >
                    {SUMMARY_METRIC_OPTIONS.map((opt) => (
                      <button
                        key={`win-${opt.id}`}
                        type="button"
                        onClick={() => setWinnersSortMetric(opt.id)}
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                          winnersSortMetric === opt.id
                            ? 'bg-stone-900 text-[#FBF9F5]'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <h3 className="text-lg font-display font-semibold text-stone-900 mt-1.5">
                  Top Overperformers &amp; Defining Victories
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-stone-600 leading-relaxed">
                  {winnersSortMetric === 'mean' && (
                    <>
                      Democrats flipped <strong className="font-mono">{flipCount}</strong> statewide
                      seats—headlined by <strong>James Talarico</strong>&apos;s cycle-high{' '}
                      <span className="font-mono">
                        {formatSignedMargin(txSenMetric?.rawShift ?? 25.7)}
                      </span>{' '}
                      raw /{' '}
                      <span className="font-mono">
                        {formatSignedMargin(txSenMetric?.afterMeanResidual ?? 10.5)}
                      </span>{' '}
                      mean-adjusted swing in Texas, alongside <strong>Rob Sand</strong> (IA-Gov,{' '}
                      <span className="font-mono">
                        {formatSignedMargin(iaGovMetric?.afterMeanResidual ?? 9.0)}
                      </span>
                      ), <strong>Josh Shapiro</strong> (PA-Gov,{' '}
                      <span className="font-mono">
                        {formatSignedMargin(paGovMetric?.afterMeanResidual ?? 8.7)}
                      </span>
                      ), and <strong>Roy Cooper</strong> (NC-Sen,{' '}
                      <span className="font-mono">
                        {formatSignedMargin(ncSenMetric?.afterMeanResidual ?? 7.6)}
                      </span>
                      ). Switch above to see how ceiling room or CVAP tilt reorders this top five.
                    </>
                  )}
                  {winnersSortMetric === 'logit' && (
                    <>
                      Adjusted for ceiling room on the Logit potential-gain curve,{' '}
                      <strong>Jack Reed</strong> (RI-Sen,{' '}
                      <span className="font-mono text-[#4338CA]">
                        {formatSignedMargin(riSenMetric?.logitAdjustedResidual ?? 12.0)}
                      </span>
                      ) moves to #1 for expanding a D+13.8 seat to D+37.5, followed by{' '}
                      <strong>Josh Shapiro</strong> (PA-Gov,{' '}
                      <span className="font-mono text-[#4338CA]">
                        {formatSignedMargin(paGovMetric?.logitAdjustedResidual ?? 9.3)}
                      </span>
                      ), <strong>James Talarico</strong> (TX-Sen,{' '}
                      <span className="font-mono text-[#4338CA]">
                        {formatSignedMargin(txSenMetric?.logitAdjustedResidual ?? 9.0)}
                      </span>
                      ), and <strong>Cory Booker</strong> (NJ-Sen).
                    </>
                  )}
                  {winnersSortMetric === 'adjusted' && (
                    <>
                      Subtracting each state&apos;s CVAP demographic tailwind elevates{' '}
                      <strong>Rob Sand</strong> (IA-Gov,{' '}
                      <span className="font-mono text-[#0F766E]">
                        {formatSignedMargin(iaGovMetric?.adjustedDifference ?? 11.1)}
                      </span>
                      ) to #1 and pulls <strong>Rachel Fetty Anderson</strong> (WV-Sen,{' '}
                      <span className="font-mono text-[#0F766E]">
                        {formatSignedMargin(wvSenMetric?.adjustedDifference ?? 9.2)}
                      </span>
                      ) and <strong>Annie Andrews</strong> (SC-Sen) into the top five, while trimming{' '}
                      <strong>James Talarico</strong> (
                      <span className="font-mono">
                        {formatSignedMargin(txSenMetric?.adjustedDifference ?? 5.2)}
                      </span>
                      ) due to Texas&apos;s{' '}
                      <span className="font-mono">
                        {formatSignedMargin(txSenMetric?.demographicWeight ?? 5.3)}
                      </span>{' '}
                      Latino rebound tailwind.
                    </>
                  )}
                  {winnersSortMetric === 'raw' && (
                    <>
                      Measured by unadjusted swing vs. 2024 presidential margins, the top five
                      matches <strong>Mean-Adjusted</strong> exactly—led by{' '}
                      <strong>TX-Sen</strong> (
                      <span className="font-mono text-[#1E3A8A]">
                        {formatSignedMargin(txSenMetric?.rawShift ?? 25.7)}
                      </span>
                      ), <strong>IA-Gov</strong> (
                      <span className="font-mono text-[#1E3A8A]">
                        {formatSignedMargin(iaGovMetric?.rawShift ?? 24.3)}
                      </span>
                      ), and <strong>PA-Gov</strong> (
                      <span className="font-mono text-[#1E3A8A]">
                        {formatSignedMargin(paGovMetric?.rawShift ?? 24.0)}
                      </span>
                      )—because subtracting a single national mean preserves the exact order.
                    </>
                  )}
                </p>

                <div className="mt-4 border border-stone-200 rounded overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#F7F4EE] border-b border-stone-200 text-stone-500">
                      <tr>
                        <th className="py-2 px-3 font-medium">
                          Top 5 by {SUMMARY_METRIC_OPTIONS.find((o) => o.id === winnersSortMetric)?.label}
                        </th>
                        <th
                          className={`py-2 px-2 text-right ${
                            winnersSortMetric === 'mean' ? 'font-semibold text-stone-900' : 'font-medium'
                          }`}
                        >
                          Mean-Adj.
                        </th>
                        <th
                          className={`py-2 px-2 text-right ${
                            winnersSortMetric === 'logit' ? 'font-semibold text-[#4338CA]' : 'font-medium'
                          }`}
                        >
                          Logit-Adj.
                        </th>
                        <th
                          className={`py-2 px-2 text-right ${
                            winnersSortMetric === 'raw' ? 'font-semibold text-[#1E3A8A]' : 'font-medium'
                          }`}
                        >
                          Raw
                        </th>
                        <th
                          className={`py-2 px-3 text-right ${
                            winnersSortMetric === 'adjusted' ? 'font-semibold text-[#0F766E]' : 'font-medium'
                          }`}
                        >
                          Demo-Adj.
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {topOverperformers.map((row) => (
                        <tr
                          key={row.race.id}
                          onClick={() => {
                            setSelectedStateCode(row.race.stateCode);
                            document.getElementById('state-map')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="hover:bg-stone-50 cursor-pointer"
                        >
                          <td className="py-2 px-3">
                            <span className="font-semibold text-stone-900">
                              {row.race.stateCode} {row.race.office === 'Senate' ? 'Sen' : 'Gov'} ·{' '}
                              {row.race.featuredCandidate}
                            </span>
                            <span className="block text-[11px] text-stone-500">
                              {row.race.flipped
                                ? 'Flipped seat (D)'
                                : row.race.demOrCoalitionMargin2026 < 0
                                  ? `Lost (${row.race.featuredParty}), +${row.rawShift.toFixed(1)}-pt gain`
                                  : 'Incumbent party hold'}
                            </span>
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-mono tabular-nums ${
                              winnersSortMetric === 'mean'
                                ? 'font-semibold text-[#0F766E] bg-[#F5F2EB]/60'
                                : 'text-stone-700'
                            }`}
                          >
                            {formatSignedMargin(row.afterMeanResidual)}
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-mono tabular-nums ${
                              winnersSortMetric === 'logit'
                                ? 'font-semibold text-[#4338CA] bg-[#F5F2EB]/60'
                                : 'text-[#4338CA]'
                            }`}
                          >
                            {formatSignedMargin(row.logitAdjustedResidual)}
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-mono tabular-nums ${
                              winnersSortMetric === 'raw'
                                ? 'font-semibold text-[#1E3A8A] bg-[#F5F2EB]/60'
                                : 'text-[#1E3A8A]'
                            }`}
                          >
                            {formatSignedMargin(row.rawShift)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-mono tabular-nums ${
                              winnersSortMetric === 'adjusted'
                                ? 'font-semibold text-[#0F766E] bg-[#F5F2EB]/60'
                                : 'text-stone-700'
                            }`}
                          >
                            {formatSignedMargin(row.adjustedDifference)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-6 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs font-semibold text-[#9A3412]">
                    Finding 04 · Biggest Losers (
                    {SUMMARY_METRIC_OPTIONS.find((o) => o.id === losersSortMetric)?.label})
                  </p>
                  <div
                    className="inline-flex items-center p-0.5 bg-[#EFECE5] border border-stone-200 rounded"
                    role="group"
                    aria-label="Sort Biggest Losers by metric"
                  >
                    {SUMMARY_METRIC_OPTIONS.map((opt) => (
                      <button
                        key={`lose-${opt.id}`}
                        type="button"
                        onClick={() => setLosersSortMetric(opt.id)}
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                          losersSortMetric === opt.id
                            ? 'bg-stone-900 text-[#FBF9F5]'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <h3 className="text-lg font-display font-semibold text-stone-900 mt-1.5">
                  {losersSortMetric === 'logit'
                    ? 'Steepest Underperformers Relative to Achievable Ground'
                    : losersSortMetric === 'adjusted'
                      ? 'Bottom Five After Removing Wave & Demographic Tailwinds'
                      : 'Bottom Five Under Flat National Wave Subtraction'}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-stone-600 leading-relaxed">
                  {losersSortMetric === 'logit' && (
                    <>
                      For Biggest Losers, linear wave subtraction unfairly penalizes safe-blue
                      winners like <strong>MA-Sen</strong> (D+25.2 → D+31.3) and{' '}
                      <strong>NY-Gov</strong> (D+12.6 → D+19.7) who lacked +15 pts of ceiling room.{' '}
                      <strong>Logit-Adjusted</strong> clears both out of the bottom five (to{' '}
                      <span className="font-mono">
                        {formatSignedMargin(maSenMetric?.logitAdjustedResidual ?? -3.1)}
                      </span>{' '}
                      and{' '}
                      <span className="font-mono">
                        {formatSignedMargin(nyGovMetric?.logitAdjustedResidual ?? -4.8)}
                      </span>
                      ) and spotlights races that left achievable ground behind—including{' '}
                      <strong>Angie Nixon</strong> (FL-Sen) and <strong>Seth Bodnar</strong>{' '}
                      (MT-Sen) alongside <strong>ME-Sen</strong>, <strong>OR-Sen</strong>, and{' '}
                      <strong>MN-Sen</strong>.
                    </>
                  )}
                  {losersSortMetric === 'mean' && (
                    <>
                      Under flat <strong>Mean-Adjusted</strong> wave subtraction, safe-blue holds{' '}
                      <strong>MA-Sen</strong> (
                      <span className="font-mono text-[#9A3412]">
                        {formatSignedMargin(maSenMetric?.afterMeanResidual ?? -9.2)}
                      </span>
                      ) and <strong>NY-Gov</strong> (
                      <span className="font-mono text-[#9A3412]">
                        {formatSignedMargin(nyGovMetric?.afterMeanResidual ?? -8.2)}
                      </span>
                      ) drop into the bottom five alongside <strong>ME-Sen</strong>,{' '}
                      <strong>OR-Sen</strong>, and <strong>MN-Sen</strong>—illustrating why
                      potential ground gain changes who looks like a loser.
                    </>
                  )}
                  {losersSortMetric === 'adjusted' && (
                    <>
                      Adding CVAP demographics pulls <strong>CA-Gov</strong> (
                      <span className="font-mono text-[#9A3412]">
                        {formatSignedMargin(caGovMetric?.adjustedDifference ?? -10.0)}
                      </span>
                      ) into the bottom five alongside <strong>OR-Sen</strong>,{' '}
                      <strong>ME-Sen</strong>, <strong>NY-Gov</strong>, and <strong>MA-Sen</strong>
                      —since California&apos;s diverse CVAP predicts a{' '}
                      <span className="font-mono">
                        {formatSignedMargin(caGovMetric?.demographicWeight ?? 5.8)}
                      </span>{' '}
                      tailwind on top of the national wave, even though D+20.2 leaves limited room.
                    </>
                  )}
                  {losersSortMetric === 'raw' && (
                    <>
                      Sorted by unadjusted swing vs. 2024, only <strong>ME-Sen</strong> (
                      <span className="font-mono text-[#9A3412]">
                        {formatSignedMargin(
                          widestUnderperformers[0]?.rawShift ?? -0.6
                        )}
                      </span>
                      , still unseating Susan Collins) moved backward vs. Harris, while{' '}
                      <strong>OR-Sen</strong>, <strong>MN-Sen</strong>, <strong>MA-Sen</strong>,
                      and <strong>NY-Gov</strong> posted modest gains below the +{activeNationalAvgShift.toFixed(1)}-pt wave.
                    </>
                  )}
                </p>

                <div className="mt-4 border border-stone-200 rounded overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#F7F4EE] border-b border-stone-200 text-stone-500">
                      <tr>
                        <th className="py-2 px-3 font-medium">
                          Bottom 5 by {SUMMARY_METRIC_OPTIONS.find((o) => o.id === losersSortMetric)?.label}
                        </th>
                        <th
                          className={`py-2 px-2 text-right ${
                            losersSortMetric === 'logit' ? 'font-semibold text-[#9A3412]' : 'font-medium'
                          }`}
                        >
                          Logit-Adj.
                        </th>
                        <th
                          className={`py-2 px-2 text-right ${
                            losersSortMetric === 'mean' ? 'font-semibold text-[#9A3412]' : 'font-medium'
                          }`}
                        >
                          Mean-Adj.
                        </th>
                        <th
                          className={`py-2 px-2 text-right ${
                            losersSortMetric === 'raw' ? 'font-semibold text-[#9A3412]' : 'font-medium'
                          }`}
                        >
                          Raw
                        </th>
                        <th
                          className={`py-2 px-3 text-right ${
                            losersSortMetric === 'adjusted' ? 'font-semibold text-[#9A3412]' : 'font-medium'
                          }`}
                        >
                          Demo-Adj.
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {widestUnderperformers.map((row) => (
                        <tr
                          key={row.race.id}
                          onClick={() => {
                            setSelectedStateCode(row.race.stateCode);
                            document.getElementById('state-map')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="hover:bg-stone-50 cursor-pointer"
                        >
                          <td className="py-2 px-3">
                            <span className="font-semibold text-stone-900">
                              {row.race.stateCode} {row.race.office === 'Senate' ? 'Sen' : 'Gov'} ·{' '}
                              {row.race.featuredCandidate}
                            </span>
                            <span className="block text-[11px] text-stone-500">
                              {row.race.id === 'ME-SEN'
                                ? 'Unseated Collins (R) despite −0.6 vs. 2024'
                                : losersSortMetric === 'logit'
                                  ? `Expected ${row.logitExpectedShift.toFixed(1)}-pt logit gain`
                                  : losersSortMetric === 'adjusted'
                                    ? `CVAP tilt ${formatSignedMargin(row.demographicWeight)} pts`
                                    : `2024: ${row.race.presMargin2024 >= 0 ? `D+${row.race.presMargin2024.toFixed(1)}` : `R+${Math.abs(row.race.presMargin2024).toFixed(1)}`}`}
                            </span>
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-mono tabular-nums ${
                              losersSortMetric === 'logit'
                                ? 'font-semibold text-[#9A3412] bg-[#F5F2EB]/60'
                                : 'text-stone-700'
                            }`}
                          >
                            {formatSignedMargin(row.logitAdjustedResidual)}
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-mono tabular-nums ${
                              losersSortMetric === 'mean'
                                ? 'font-semibold text-[#9A3412] bg-[#F5F2EB]/60'
                                : 'text-stone-700'
                            }`}
                          >
                            {formatSignedMargin(row.afterMeanResidual)}
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-mono tabular-nums ${
                              losersSortMetric === 'raw'
                                ? 'font-semibold text-[#9A3412] bg-[#F5F2EB]/60'
                                : 'text-[#1E3A8A]'
                            }`}
                          >
                            {formatSignedMargin(row.rawShift)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-mono tabular-nums ${
                              losersSortMetric === 'adjusted'
                                ? 'font-semibold text-[#9A3412] bg-[#F5F2EB]/60'
                                : 'text-stone-700'
                            }`}
                          >
                            {formatSignedMargin(row.adjustedDifference)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Transparency, Open Source & Extensibility */}
        <section id="transparency" className="py-12 border-t border-stone-200 scroll-mt-20">
          <div className="mb-8 max-w-3xl">
            <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
              06 · Transparency &amp; Extensibility · Check Our Work
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-semibold text-stone-900 mt-1">
              Think We Missed Something? Source Code Is Open and Revisions Are Welcome
            </h2>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              Every 2024 baseline, 2026 vote share, CVAP weight, and camp tag lives in standalone code
              so anyone can audit or challenge the math.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-stone-200 rounded-lg p-6">
              <p className="font-mono text-xs font-semibold text-[#1E3A8A]">
                01 · Auditable Engine
              </p>
              <h3 className="text-lg font-display font-semibold text-stone-900 mt-1.5">
                Pure Code, Zero Black Boxes
              </h3>
              <p className="mt-2 text-sm text-stone-700 leading-relaxed">
                All math sits in{' '}
                <code className="font-mono text-xs bg-[#F5F2EB] px-1.5 py-0.5 rounded border border-stone-200">
                  src/analysis/
                </code>{' '}
                (<code className="font-mono text-xs">datasets.ts</code>,{' '}
                <code className="font-mono text-xs">shiftModel.ts</code>,{' '}
                <code className="font-mono text-xs">demographicModel.ts</code>), with full JSON
                exports in Sections 03 and 04.
              </p>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-6">
              <p className="font-mono text-xs font-semibold text-[#0F766E]">
                02 · Built to Extend
              </p>
              <h3 className="text-lg font-display font-semibold text-stone-900 mt-1.5">
                Swap Assumptions or Add Races
              </h3>
              <p className="mt-2 text-sm text-stone-700 leading-relaxed">
                Adjust the exit-poll vector in{' '}
                <code className="font-mono text-xs bg-[#F5F2EB] px-1.5 py-0.5 rounded border border-stone-200">
                  demographicModel.ts
                </code>{' '}
                or add House districts and county canvases directly inside{' '}
                <code className="font-mono text-xs bg-[#F5F2EB] px-1.5 py-0.5 rounded border border-stone-200">
                  datasets.ts
                </code>
                .
              </p>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-6">
              <p className="font-mono text-xs font-semibold text-[#9A3412]">
                03 · Living Ledger
              </p>
              <h3 className="text-lg font-display font-semibold text-stone-900 mt-1.5">
                Revisions &amp; Counter-Models Welcome
              </h3>
              <p className="mt-2 text-sm text-stone-700 leading-relaxed">
                Spot an updated canvass or prefer different ideological tags? Reassign camps live in
                Section 03 or propose revisions directly against the source.
              </p>
            </div>
          </div>

          <div className="mt-6 p-5 bg-[#F5F2EB] border border-stone-200 rounded-lg flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs sm:text-sm text-stone-700">
              <strong className="font-semibold text-stone-900">Want to verify a number?</strong>{' '}
              Trace every race back to its NARA 2024 baseline and 2026 AP / DDHQ / Ballotpedia
              citation below.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
              <a
                href="#demographics"
                className="px-3.5 py-2 bg-white border border-stone-300 rounded hover:border-stone-500 text-stone-800 transition-colors whitespace-nowrap"
              >
                Review Demographic Breakdown ↑
              </a>
              <button
                type="button"
                onClick={() => setMethodologyOpen(true)}
                className="px-3.5 py-2 bg-stone-900 text-[#FBF9F5] hover:bg-stone-800 rounded transition-colors whitespace-nowrap cursor-pointer"
              >
                Inspect Methodology &amp; Sources
              </button>
            </div>
          </div>
        </section>

        {/* Section 7: Primary Data Sources & Open-Source Methodology */}
        <section id="sources" className="py-12 border-t border-stone-200 scroll-mt-20">
          <div className="mb-8 max-w-3xl">
            <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
              07 · Primary Sources &amp; Open-Source Methodology
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-semibold text-stone-900 mt-1">
              How the Primary Datasets Were Aggregated
            </h2>
          </div>

          {/* 4-Step Aggregation Pipeline */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
            <div className="bg-[#F5F2EB] border border-stone-200 rounded-lg p-5">
              <p className="font-mono text-xs text-stone-500">01 · 2024 Baseline</p>
              <h3 className="text-base font-display font-semibold text-stone-900 mt-1">
                Certified Margin
              </h3>
              <p className="mt-1.5 text-xs text-stone-700 leading-relaxed">
                NARA &amp; UCSB state shares normalized to{' '}
                <code className="font-mono bg-white px-1 py-0.5 rounded border border-stone-200">
                  M₂₄ = Harris% − Trump%
                </code>
                .
              </p>
            </div>

            <div className="bg-[#F5F2EB] border border-stone-200 rounded-lg p-5">
              <p className="font-mono text-xs text-stone-500">02 · 2026 Ingestion</p>
              <h3 className="text-base font-display font-semibold text-stone-900 mt-1">
                Cross-Source Spread
              </h3>
              <p className="mt-1.5 text-xs text-stone-700 leading-relaxed">
                Reconciled across AP, DDHQ, Ballotpedia, and MultiState—including independents (NE,
                ID, MT) and RCV (AK).
              </p>
            </div>

            <div className="bg-[#F5F2EB] border border-stone-200 rounded-lg p-5">
              <p className="font-mono text-xs text-stone-500">03 · National Mean</p>
              <h3 className="text-base font-display font-semibold text-stone-900 mt-1">
                Dual Benchmarks
              </h3>
              <p className="mt-1.5 text-xs text-stone-700 leading-relaxed">
                Swings (<code className="font-mono">M₂₆ − M₂₄</code>) averaged equally (
                <strong className="font-mono">+{unweightedAvg.toFixed(1)}</strong>) and by ballots
                cast (<strong className="font-mono">+{weightedAvg.toFixed(1)}</strong>).
              </p>
            </div>

            <div className="bg-[#F5F2EB] border border-stone-200 rounded-lg p-5">
              <p className="font-mono text-xs text-stone-500">04 · Logit, CVAP &amp; Policy</p>
              <h3 className="text-base font-display font-semibold text-stone-900 mt-1">
                Potential Gain &amp; Tags
              </h3>
              <p className="mt-1.5 text-xs text-stone-700 leading-relaxed">
                Fits <code className="font-mono">logit(p₂₆) = α + β·logit(p₂₄)</code> for ceiling
                room and subtracts CVAP tilt, grouped by Pew/CWCP camp and policy pillars.
              </p>
            </div>
          </div>

          {/* Complete Categorized Source Links Grid */}
          <div className="space-y-8">
            {(
              [
                '2024 Certified Baseline',
                '2026 Vote Totals & Race Calls',
                'Exit Polls & 2028 Analysis',
              ] as SourceCategory[]
            ).map((category) => {
              const items = PRIMARY_DATA_SOURCES.filter((s) => s.category === category);
              return (
                <div key={category}>
                  <h3 className="text-sm font-sans font-semibold uppercase tracking-wider text-stone-700 pb-2 border-b border-stone-200 mb-4">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map((src) => (
                      <div
                        key={src.id}
                        className="bg-white border border-stone-200 rounded-lg p-4 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs font-mono text-stone-500">
                              {src.organization}
                            </span>
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A8A] hover:underline shrink-0"
                            >
                              <span>Open Source</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block text-sm font-semibold text-stone-900 hover:text-[#1E3A8A] transition-colors"
                          >
                            {src.name}
                          </a>
                          <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">
                            {src.coverage}
                          </p>
                        </div>
                        <p className="mt-3 pt-2.5 border-t border-stone-100 text-[11px] text-stone-500">
                          <strong className="text-stone-700 font-medium">Role in dataset:</strong>{' '}
                          {src.aggregationRole}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-[#F5F2EB] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-stone-500">
          <div>
            <span className="font-display font-semibold text-stone-800 text-sm">
              The 2026 Ledger
            </span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span>
              Data grounded in AP, Decision Desk HQ, Ballotpedia, Cook Political Report, CBS News,
              PBS, Brookings &amp; Washington Post reporting.
            </span>
          </div>
          <div className="flex items-center gap-5 shrink-0">
            <button
              type="button"
              onClick={() => setMethodologyOpen(true)}
              className="hover:text-stone-900 underline underline-offset-4 cursor-pointer"
            >
              Methodology &amp; Sources
            </button>
            <a href="#top" className="hover:text-stone-900 underline underline-offset-4">
              Back to top
            </a>
          </div>
        </div>
      </footer>

      <MethodologyModal
        open={methodologyOpen}
        onClose={() => setMethodologyOpen(false)}
        unweightedAvg={unweightedAvg}
        weightedAvg={weightedAvg}
        raceCount={STATEWIDE_RACES_2026.length}
      />
    </div>
  );
}
