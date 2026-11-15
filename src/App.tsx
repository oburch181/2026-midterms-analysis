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
  PRIMARY_DATA_SOURCES,
  STATEWIDE_RACES_2026,
  SourceCategory,
  calculateNationalAverageShift,
  formatSignedMargin,
} from './data/electionData';

export default function App() {
  const [benchmarkMode, setBenchmarkMode] = useState<BenchmarkMode>('unweighted');
  const demographicShifts = DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS;
  const [selectedStateCode, setSelectedStateCode] = useState<string>('TX');
  const [methodologyOpen, setMethodologyOpen] = useState<boolean>(false);
  const [heroImageError, setHeroImageError] = useState<boolean>(false);

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

  const factionSummary = useMemo(
    () => aggregateByFaction(RAW_RACES_2026, activeNationalAvgShift, combinedMap),
    [activeNationalAvgShift, combinedMap]
  );
  const ctrAgg = factionSummary.find((f) => f.faction === 'Pragmatic Center-Left');
  const popAgg = factionSummary.find((f) => f.faction === 'Economic Populist & Labor');
  const progAgg = factionSummary.find((f) => f.faction === 'Progressive Reformer');

  const policySummary = useMemo(
    () => aggregateByPolicy(RAW_RACES_2026, activeNationalAvgShift, undefined, combinedMap),
    [activeNationalAvgShift, combinedMap]
  );
  const tradePolicy = policySummary.find((p) => p.pillar === 'Trade & Tariffs');
  const eduPolicy = policySummary.find((p) => p.pillar === 'Public Education & Anti-Voucher');
  const antiCorrPolicy = policySummary.find(
    (p) => p.pillar === 'Anti-Corruption & Accountability'
  );

  const txSenMetric = combinedMetrics.find((m) => m.race.id === 'TX-SEN');
  const txGovMetric = combinedMetrics.find((m) => m.race.id === 'TX-GOV');
  const paGovMetric = combinedMetrics.find((m) => m.race.id === 'PA-GOV');
  const iaGovMetric = combinedMetrics.find((m) => m.race.id === 'IA-GOV');
  const nmSenMetric = combinedMetrics.find((m) => m.race.id === 'NM-SEN');
  const caGovMetric = combinedMetrics.find((m) => m.race.id === 'CA-GOV');
  const wvSenMetric = combinedMetrics.find((m) => m.race.id === 'WV-SEN');

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

  const sortedByDemoAdj = useMemo(
    () => [...combinedMetrics].sort((a, b) => b.adjustedDifference - a.adjustedDifference),
    [combinedMetrics]
  );
  const topOverperformers = sortedByDemoAdj.slice(0, 5);
  const widestUnderperformers = [...sortedByDemoAdj].reverse().slice(0, 5);

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
              What Tuesday&apos;s Swings Actually Tell Us About 2028
            </h1>

            <p className="mt-4 text-lg sm:text-xl font-serif text-stone-600 leading-relaxed max-w-3xl">
              Raw election night margins make a wave look uniform. When we normalize Tuesday&apos;s{' '}
              {STATEWIDE_RACES_2026.length} Senate and Governor races against 2024 baselines—and
              then against national demographic shifts—we can see who truly outran the tide, and
              what story that leftover gap tells.
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
                D ~56% to R ~42% (AP / Ballotpedia)
              </span>
            </div>
          </div>

          {/* Data-Level Questions & Narrative Approach */}
          <section id="thesis" className="mt-12 scroll-mt-24">
            <div className="mb-8 p-6 sm:p-8 bg-[#F5F2EB] border border-stone-200 rounded-lg">
              <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
                The Core Lens · Three Numbers That Matter
              </p>
              <h2 className="text-xl sm:text-2xl font-display font-semibold text-stone-900 mt-1">
                Separating Candidate Appeal From the National Tide and State Demographics
              </h2>
              <p className="mt-2 text-sm text-stone-700 leading-relaxed max-w-3xl">
                When Democrats flip seats from Texas to Maine, raw margins make the entire map look
                like one sweeping story. To see what voters actually rewarded in 2026—and what
                matters for 2028—we track three paired numbers for every statewide race:
              </p>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white border border-stone-200 rounded p-4">
                  <p className="font-mono text-xs font-semibold text-[#1E3A8A]">
                    01 · Raw Diff. (2026 − 2024)
                  </p>
                  <p className="mt-1.5 text-stone-700 leading-relaxed text-xs sm:text-sm">
                    Measures how far each state moved compared to its certified 2024 presidential
                    vote—capturing the full election-night swing (averaging{' '}
                    <strong className="font-mono">+{unweightedAvg.toFixed(1)} pts</strong>).
                  </p>
                </div>

                <div className="bg-white border border-stone-200 rounded p-4">
                  <p className="font-mono text-xs font-semibold text-stone-900">
                    02 · Mean-Adjusted (vs. Tide)
                  </p>
                  <p className="mt-1.5 text-stone-700 leading-relaxed text-xs sm:text-sm">
                    Subtracts the national mean swing (<strong className="font-mono">+{unweightedAvg.toFixed(1)}</strong>{' '}
                    unweighted / <strong className="font-mono">+{weightedAvg.toFixed(1)}</strong>{' '}
                    weighted) so we see who outran the nationwide wave.
                  </p>
                </div>

                <div className="bg-white border border-stone-200 rounded p-4">
                  <p className="font-mono text-xs font-semibold text-[#0F766E]">
                    03 · Demo-Adjusted (Tide + CVAP)
                  </p>
                  <p className="mt-1.5 text-stone-700 leading-relaxed text-xs sm:text-sm">
                    Subtracts both the national mean and each state&apos;s{' '}
                    <strong>demographic CVAP tilt</strong>—isolating performance beyond national
                    group swings. (See Section 04.)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-8 prose-editorial space-y-5 max-w-2xl">
                <p className="first-letter:text-5xl first-letter:font-display first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-none first-letter:text-stone-900">
                  <strong>Here&apos;s how we start:</strong> Before comparing candidates across
                  different regions, every state needs a common baseline. We anchor all{' '}
                  <span className="font-mono text-sm tabular-nums">
                    {STATEWIDE_RACES_2026.length}
                  </span>{' '}
                  contested November 3, 2026 Senate and Governor races—compiled from the{' '}
                  <a
                    href="https://apnews.com/hub/2026-midterm-election"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-4 text-stone-900"
                  >
                    Associated Press
                  </a>
                  ,{' '}
                  <a
                    href="https://results.decisiondeskhq.com/2026/general"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-4 text-stone-900"
                  >
                    Decision Desk HQ
                  </a>
                  , and{' '}
                  <a
                    href="https://ballotpedia.org/United_States_Senate_elections,_2026"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-4 text-stone-900"
                  >
                    Ballotpedia
                  </a>
                  —against certified 2024 presidential margins from the{' '}
                  <a
                    href="https://www.archives.gov/electoral-college/2024"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-4 text-stone-900"
                  >
                    National Archives
                  </a>{' '}
                  and{' '}
                  <a
                    href="https://www.presidency.ucsb.edu/statistics/elections/2024"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-4 text-stone-900"
                  >
                    UC Santa Barbara
                  </a>
                  .
                </p>

                <p>
                  Measured against 2024, the average statewide shift toward Democrats (or non-GOP
                  coalition challengers) reached{' '}
                  <strong className="font-semibold text-stone-900">
                    +{unweightedAvg.toFixed(1)} points
                  </strong>{' '}
                  unweighted (
                  <strong className="font-semibold text-stone-900">
                    +{weightedAvg.toFixed(1)} points
                  </strong>{' '}
                  weighted by ballots cast). Subtracting that national average from each
                  race&apos;s raw swing normalizes away the tide itself—leaving behind the
                  candidate-and-state gap we examine by ideological wing and policy stance (
                  <a
                    href="#sources"
                    className="text-[#1E3A8A] underline underline-offset-4 font-sans text-sm"
                  >
                    see aggregation details &amp; source links
                  </a>
                  ).
                </p>

                <p>
                  Then we normalize one layer deeper. Exit analyses in{' '}
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
                  show a massive national rebound among Hispanic, AAPI, and non-college voters. By
                  building a state-by-state demographic estimator, we can ask a sharper question:
                  how much of Texas&apos;s 25.7-point Senate swing was simply its 32.3% Latino
                  electorate reverting to form—and how much was earned by the campaign itself?
                </p>
              </div>

            {/* Right Margin Notes Rail */}
            <aside className="lg:col-span-4 space-y-6 text-sm">
              <div className="p-5 bg-[#F5F2EB] border border-stone-200 rounded-lg">
                <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
                  Context Note 01 · Even Safe States Moved
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
                  analyses note that even in safe Republican states that did not flip—such as West
                  Virginia, Alabama, and Kentucky—GOP Senate winning margins compressed by 18 to
                  21.5 points relative to 2024 presidential totals.
                </p>
              </div>

              <div className="p-5 bg-[#F5F2EB] border border-stone-200 rounded-lg">
                <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
                  Context Note 02 · Who Shifted Nationally
                </p>
                <p className="mt-2 text-stone-700 leading-relaxed">
                  Post-election exit data cited by the{' '}
                  <a
                    href="https://www.americanprogress.org/article/working-class-voters-shifted-toward-democratic-and-independent-candidates-in-nearly-every-2026-senate-race/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-2 font-medium"
                  >
                    Center for American Progress
                  </a>{' '}
                  indicates non-college-educated voters swung back toward Democratic and independent
                  candidates in key Senate races, alongside a sharp rebound among Latino voters in
                  Texas and Nevada (
                  <a
                    href="https://www.brookings.edu/topics/2026-midterm-elections/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-stone-300 hover:decoration-[#1E3A8A] underline-offset-2"
                  >
                    Brookings
                  </a>
                  )—feeding directly into the Demographic-Adjusted Difference metric detailed in
                  Sections 02 and 04.
                </p>
              </div>
            </aside>
            </div>
          </section>

          {/* Editorial Pull Quote (Top/Bottom hairlines, zero thick left bar) */}
          <blockquote className="my-12 py-8 border-t border-b border-stone-300 max-w-4xl mx-auto text-center">
            <p className="font-display italic text-2xl sm:text-3xl text-stone-800 leading-snug">
              &ldquo;Tuesday&apos;s map rewarded neither pure moderation nor pure insurgency—it
              rewarded candidates who translated grocery, utility, and healthcare strain into
              credible local accountability.&rdquo;
            </p>
            <footer className="mt-3 text-xs uppercase tracking-widest text-stone-500 font-sans">
              Synthesis of Brookings, Cook Political Report &amp; AP 2026 Exit Coverage
            </footer>
          </blockquote>
        </article>

        {/* Interactive Section 1: US State Tile Cartogram */}
        <USStateTileMap
          benchmarkMode={benchmarkMode}
          onChangeBenchmarkMode={setBenchmarkMode}
          nationalAvgShift={activeNationalAvgShift}
          demographicShifts={demographicShifts}
          selectedStateCode={selectedStateCode}
          onSelectState={setSelectedStateCode}
        />

        {/* Interactive Section 2: Raw Shift vs Demographic-Adjusted Difference */}
        <OverperformanceChart
          benchmarkMode={benchmarkMode}
          nationalAvgShift={activeNationalAvgShift}
          demographicShifts={demographicShifts}
          selectedStateCode={selectedStateCode}
          onSelectState={setSelectedStateCode}
        />

        {/* Interactive Section 3: Affiliation Camps & Policy Pillars */}
        <AffiliationPolicyAnalysis
          benchmarkMode={benchmarkMode}
          nationalAvgShift={activeNationalAvgShift}
          demographicShifts={demographicShifts}
          onSelectState={setSelectedStateCode}
        />

        {/* Interactive Section 4: The Demographic Story */}
        <DemographicStorySection
          benchmarkMode={benchmarkMode}
          nationalAvgShift={activeNationalAvgShift}
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
              Once you subtract the{' '}
              <strong className="font-mono">+{activeNationalAvgShift.toFixed(1)} pt</strong>{' '}
              national tide, adding state-level CVAP demographics changes very little of the broader
              picture: Mean-Adjusted and Demo-Adjusted scores track each other closely (
              <strong className="font-mono">r = {modelConvergence.r.toFixed(2)}</strong>),{' '}
              <strong className="font-mono">{modelConvergence.sameSignCount}</strong> of{' '}
              <strong className="font-mono">{combinedMetrics.length}</strong> races keep the exact
              same positive or negative sign, and{' '}
              <strong className="font-mono">{modelConvergence.withinTwoCount}</strong> states shift
              by two points or less. Where demographics do matter is explaining a handful of
              high-Latino rebounds—trimming <strong>Texas</strong> (James Talarico from{' '}
              <span className="font-mono">
                {formatSignedMargin(txSenMetric?.afterMeanResidual ?? 10.5)}
              </span>{' '}
              mean-adj. to{' '}
              <span className="font-mono">
                {formatSignedMargin(txSenMetric?.adjustedDifference ?? 5.2)}
              </span>{' '}
              demo-adj.; Gina Hinojosa from{' '}
              <span className="font-mono">
                {formatSignedMargin(txGovMetric?.afterMeanResidual ?? 5.5)}
              </span>{' '}
              to{' '}
              <span className="font-mono">
                {formatSignedMargin(txGovMetric?.adjustedDifference ?? 0.2)}
              </span>
              ), <strong>New Mexico</strong> (
              <span className="font-mono">
                {formatSignedMargin(nmSenMetric?.afterMeanResidual ?? 5.3)}
              </span>{' '}
              to{' '}
              <span className="font-mono">
                {formatSignedMargin(nmSenMetric?.adjustedDifference ?? -2.3)}
              </span>
              ), and <strong>California</strong> (
              <span className="font-mono">
                {formatSignedMargin(caGovMetric?.afterMeanResidual ?? -4.3)}
              </span>{' '}
              to{' '}
              <span className="font-mono">
                {formatSignedMargin(caGovMetric?.adjustedDifference ?? -10.0)}
              </span>
              )—while giving modest extra credit to predominantly White states like{' '}
              <strong>Iowa</strong> (
              <span className="font-mono">
                {formatSignedMargin(iaGovMetric?.afterMeanResidual ?? 9.0)}
              </span>{' '}
              to{' '}
              <span className="font-mono">
                {formatSignedMargin(iaGovMetric?.adjustedDifference ?? 11.1)}
              </span>
              ) and <strong>West Virginia</strong> (
              <span className="font-mono">
                {formatSignedMargin(wvSenMetric?.afterMeanResidual ?? 6.2)}
              </span>{' '}
              to{' '}
              <span className="font-mono">
                {formatSignedMargin(wvSenMetric?.adjustedDifference ?? 9.2)}
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
                    {formatSignedMargin(tradePolicy?.avgCombinedAdjustedResidual ?? 5.8)}
                  </strong>{' '}
                  demo-adj., {tradePolicy?.flips ?? 4} flips in 5 races), followed by{' '}
                  <strong>Public Education &amp; Anti-Voucher</strong> (
                  <strong className="font-mono">
                    {formatSignedMargin(eduPolicy?.avgCombinedAdjustedResidual ?? 1.8)}
                  </strong>
                  , {eduPolicy?.flips ?? 7} flips) and{' '}
                  <strong>Anti-Corruption &amp; Accountability</strong> (
                  <strong className="font-mono">
                    {formatSignedMargin(antiCorrPolicy?.avgCombinedAdjustedResidual ?? 1.4)}
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
                  <strong className="font-mono">{costPolicy?.count ?? 38}</strong> of{' '}
                  {STATEWIDE_RACES_2026.length} tracked campaigns and posted a near-baseline{' '}
                  <strong className="font-mono">
                    {formatSignedMargin(costPolicy?.avgCombinedAdjustedResidual ?? 0.5)}
                  </strong>{' '}
                  demo-adj. average—serving as universal entry stakes across the map rather than a
                  separating advantage on its own.
                </p>
              </div>

              <div className="p-4 bg-[#F7F4EE] border border-stone-200 rounded">
                <p className="text-xs font-mono font-semibold text-[#9A3412]">
                  Lagged the Wave · Factional &amp; Safe-State Brands
                </p>
                <p className="mt-2 text-xs sm:text-sm text-stone-700 leading-relaxed">
                  <strong>Pragmatic Center-Left</strong> (
                  <strong className="font-mono">
                    {formatSignedMargin(ctrAgg?.avgCombinedAdjustedResidual ?? 1.4)}
                  </strong>{' '}
                  demo-adj., 8 flips) and <strong>Economic Populist &amp; Labor</strong> (
                  <strong className="font-mono">
                    {formatSignedMargin(popAgg?.avgCombinedAdjustedResidual ?? 1.1)}
                  </strong>
                  , 4 flips) performed nearly identically. Meanwhile{' '}
                  <strong>Labor &amp; Anti-Monopoly</strong> (
                  <strong className="font-mono">
                    {formatSignedMargin(laborPolicy?.avgCombinedAdjustedResidual ?? -3.4)}
                  </strong>
                  ) and <strong>Progressive Reformer</strong> (
                  <strong className="font-mono">
                    {formatSignedMargin(progAgg?.avgCombinedAdjustedResidual ?? -9.7)}
                  </strong>
                  ) trailed the tide, weighed down by flat margins in safe blue states.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Biggest Winners & Biggest Losers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-stone-200 rounded-lg p-6">
              <p className="font-mono text-xs font-semibold text-[#0F766E]">
                Finding 03 · Biggest Winners
              </p>
              <h3 className="text-lg font-display font-semibold text-stone-900 mt-1">
                Top Overperformers &amp; Defining Victories
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-stone-600 leading-relaxed">
                Democrats flipped <strong className="font-mono">{flipCount}</strong> statewide
                seats—headlined by <strong>James Talarico</strong>&apos;s cycle-high{' '}
                <span className="font-mono">+25.7</span> raw swing in Texas,{' '}
                <strong>Roy Cooper</strong> (+22.9) in North Carolina, and{' '}
                <strong>Annie Andrews</strong> (+22.5) in South Carolina. Adjusted for wave and
                demographics, Midwestern and Rust Belt standouts <strong>Rob Sand</strong> (IA-Gov)
                and <strong>Josh Shapiro</strong> (PA-Gov) led the entire field, while{' '}
                <strong>Byron Donalds</strong> (FL-Gov, R+1.3) and <strong>Ashley Moody</strong>{' '}
                (FL-SEN, R+3.0) notched rare GOP holds in Florida.
              </p>

              <div className="mt-4 border border-stone-200 rounded overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#F7F4EE] border-b border-stone-200 text-stone-500">
                    <tr>
                      <th className="py-2 px-3 font-medium">Top Demo-Adjusted Performers</th>
                      <th className="py-2 px-2.5 font-medium text-right">Raw</th>
                      <th className="py-2 px-2.5 font-medium text-right">Mean-Adj.</th>
                      <th className="py-2 px-3 font-medium text-right">Demo-Adj.</th>
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
                              : row.race.id === 'WV-SEN'
                                ? 'R hold, 21.5-pt D margin compression'
                                : 'Incumbent party hold'}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#1E3A8A]">
                          {formatSignedMargin(row.rawShift)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-stone-700">
                          {formatSignedMargin(row.afterMeanResidual)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-[#0F766E]">
                          {formatSignedMargin(row.adjustedDifference)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-6">
              <p className="font-mono text-xs font-semibold text-[#9A3412]">
                Finding 04 · Biggest Losers
              </p>
              <h3 className="text-lg font-display font-semibold text-stone-900 mt-1">
                Steepest Underperformers &amp; Lost Seats
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-stone-600 leading-relaxed">
                On the seat ledger, Republicans lost <strong className="font-mono">{flipCount}</strong>{' '}
                tracked Senate and Governor seats, including high-profile defeats for{' '}
                <strong>Ken Paxton</strong> (TX-Sen) and five-term incumbent{' '}
                <strong>Susan Collins</strong> (ME-Sen). On the benchmark ledger, safe-blue and
                sluggish campaigns missed the{' '}
                <span className="font-mono">+{activeNationalAvgShift.toFixed(1)}</span> national wave
                by wide margins—including <strong>OR-Sen</strong>, <strong>NY-Gov</strong>,{' '}
                <strong>CA-Gov</strong>, <strong>MA-Sen</strong>, and Michigan Senate winner{' '}
                <strong>Abdul El-Sayed</strong> (<span className="font-mono">+8.4</span> raw /{' '}
                <span className="font-mono">-5.2</span> demo-adj.).
              </p>

              <div className="mt-4 border border-stone-200 rounded overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#F7F4EE] border-b border-stone-200 text-stone-500">
                    <tr>
                      <th className="py-2 px-3 font-medium">Widest Negative Residuals</th>
                      <th className="py-2 px-2.5 font-medium text-right">Raw</th>
                      <th className="py-2 px-2.5 font-medium text-right">Mean-Adj.</th>
                      <th className="py-2 px-3 font-medium text-right">Demo-Adj.</th>
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
                              : 'Safe-blue win below national wave'}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#1E3A8A]">
                          {formatSignedMargin(row.rawShift)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-stone-700">
                          {formatSignedMargin(row.afterMeanResidual)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-[#9A3412]">
                          {formatSignedMargin(row.adjustedDifference)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              Electoral analysis should never be a black box. Every 2024 baseline, 2026 vote share,
              CVAP demographic weight, and faction tag behind this article lives in standalone code
              so journalists, researchers, and readers can inspect the math—or challenge it.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-stone-200 rounded-lg p-6">
              <p className="font-mono text-xs font-semibold text-[#1E3A8A]">
                01 · Auditable Analytical Engine
              </p>
              <h3 className="text-lg font-display font-semibold text-stone-900 mt-1.5">
                Pure Code, Zero Black Boxes
              </h3>
              <p className="mt-2 text-sm text-stone-700 leading-relaxed">
                All calculations are separated from the React layout inside{' '}
                <code className="font-mono text-xs bg-[#F5F2EB] px-1.5 py-0.5 rounded border border-stone-200">
                  src/analysis/
                </code>{' '}
                (<code className="font-mono text-xs">datasets.ts</code>,{' '}
                <code className="font-mono text-xs">shiftModel.ts</code>,{' '}
                <code className="font-mono text-xs">demographicModel.ts</code>). You can inspect
                every formula directly or export the full computed dataset as JSON in Section 04.
              </p>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-6">
              <p className="font-mono text-xs font-semibold text-[#0F766E]">
                02 · Built to Be Stress-Tested
              </p>
              <h3 className="text-lg font-display font-semibold text-stone-900 mt-1.5">
                Swap Assumptions or Extend the Map
              </h3>
              <p className="mt-2 text-sm text-stone-700 leading-relaxed">
                Want to test how alternative Latino or White turnout assumptions change Texas and
                Iowa? Swap the vector in{' '}
                <code className="font-mono text-xs bg-[#F5F2EB] px-1.5 py-0.5 rounded border border-stone-200">
                  demographicModel.ts
                </code>{' '}
                or extend the raw arrays in{' '}
                <code className="font-mono text-xs bg-[#F5F2EB] px-1.5 py-0.5 rounded border border-stone-200">
                  datasets.ts
                </code>{' '}
                to plug in U.S. House districts, county canvases, or 2028 primary models.
              </p>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-6">
              <p className="font-mono text-xs font-semibold text-[#9A3412]">
                03 · Living Electoral Ledger
              </p>
              <h3 className="text-lg font-display font-semibold text-stone-900 mt-1.5">
                Revisions &amp; Counter-Models Welcome
              </h3>
              <p className="mt-2 text-sm text-stone-700 leading-relaxed">
                Spot an updated certified canvass margin, think a candidate belongs in a different
                ideological lane, or see a policy pillar we overlooked? Because the source code and
                primary citations are open, revisions, alternative tags, and counter-analyses are
                explicitly encouraged.
              </p>
            </div>
          </div>

          <div className="mt-6 p-5 bg-[#F5F2EB] border border-stone-200 rounded-lg flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs sm:text-sm text-stone-700">
              <strong className="font-semibold text-stone-900">Want to verify a specific number?</strong>{' '}
              Trace every race back to its NARA 2024 baseline and 2026 AP / DDHQ / Ballotpedia
              source links below.
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
            <p className="text-sm text-stone-600 mt-2">
              All analytical logic is decoupled from the React interface inside{' '}
              <code className="font-mono text-xs bg-[#EFECE5] px-1.5 py-0.5 rounded border border-stone-200">
                src/analysis/
              </code>{' '}
              (<code className="font-mono text-xs">datasets.ts</code>,{' '}
              <code className="font-mono text-xs">shiftModel.ts</code>,{' '}
              <code className="font-mono text-xs">demographicModel.ts</code>,{' '}
              <code className="font-mono text-xs">types.ts</code>,{' '}
              <code className="font-mono text-xs">index.ts</code>) so every formula, CVAP weight,
              and residual can be audited or extended independently of the site layout.
            </p>
          </div>

          {/* 4-Step Aggregation Pipeline */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
            <div className="bg-[#F5F2EB] border border-stone-200 rounded-lg p-5">
              <p className="font-mono text-xs text-stone-500">01 · 2024 Baseline</p>
              <h3 className="text-base font-display font-semibold text-stone-900 mt-1">
                Certified Margin Extraction
              </h3>
              <p className="mt-2 text-xs text-stone-700 leading-relaxed">
                Statewide 2024 popular vote shares from the National Archives and UCSB American
                Presidency Project were standardized to{' '}
                <code className="font-mono bg-white px-1 py-0.5 rounded border border-stone-200">
                  M₂₄ = Harris% − Trump%
                </code>
                .
              </p>
            </div>

            <div className="bg-[#F5F2EB] border border-stone-200 rounded-lg p-5">
              <p className="font-mono text-xs text-stone-500">02 · 2026 Ingestion</p>
              <h3 className="text-base font-display font-semibold text-stone-900 mt-1">
                Cross-Source Reconciliation
              </h3>
              <p className="mt-2 text-xs text-stone-700 leading-relaxed">
                Vote totals across {STATEWIDE_RACES_2026.length} Senate &amp; Governor races were
                cross-checked across AP, DDHQ, Ballotpedia, and MultiState, converting independent
                challengers (NE, ID, MT) and RCV (AK) onto the same non-GOP vs. GOP spread.
              </p>
            </div>

            <div className="bg-[#F5F2EB] border border-stone-200 rounded-lg p-5">
              <p className="font-mono text-xs text-stone-500">03 · National Mean</p>
              <h3 className="text-base font-display font-semibold text-stone-900 mt-1">
                Dual Shift Aggregation
              </h3>
              <p className="mt-2 text-xs text-stone-700 leading-relaxed">
                Each race&apos;s swing (<code className="font-mono">M₂₆ − M₂₄</code>) is averaged
                both equally across states (<strong className="font-mono">+{unweightedAvg.toFixed(1)}</strong>)
                and weighted by 2026 ballots cast (<strong className="font-mono">+{weightedAvg.toFixed(1)}</strong>).
              </p>
            </div>

            <div className="bg-[#F5F2EB] border border-stone-200 rounded-lg p-5">
              <p className="font-mono text-xs text-stone-500">04 · Demographics &amp; Policy</p>
              <h3 className="text-base font-display font-semibold text-stone-900 mt-1">
                CVAP Weights &amp; Issue Tagging
              </h3>
              <p className="mt-2 text-xs text-stone-700 leading-relaxed">
                Subtracting both the national mean and each state&apos;s CVAP demographic tilt yields
                each candidate&apos;s Demographic-Adjusted Difference, then averaged by Pew/CWCP
                ideological lane and verified campaign policy pillar.
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
