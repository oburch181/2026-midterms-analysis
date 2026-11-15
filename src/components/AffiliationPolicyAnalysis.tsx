import { ChevronDown, ChevronRight, Download, Info, RotateCcw } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_FACTIONS,
  DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS,
  NationalDemographicShifts,
  RAW_RACES_2026,
  aggregateByFaction,
  aggregateByPolicy,
  computeCombinedAdjustedMetrics,
  computeRaceShift,
} from '../analysis';
import {
  BenchmarkMode,
  FactionLane,
  POLICY_PILLARS,
  PolicyPillar,
  STATEWIDE_RACES_2026,
  formatPartyMargin,
  formatSignedMargin,
} from '../data/electionData';

interface AffiliationPolicyAnalysisProps {
  benchmarkMode?: BenchmarkMode;
  nationalAvgShift: number;
  demographicShifts?: NationalDemographicShifts;
  factionOverrides?: Record<string, FactionLane>;
  onChangeFaction?: (raceId: string, faction: FactionLane) => void;
  onResetFactions?: () => void;
  onSelectState: (code: string) => void;
}

interface ColumnTooltipProps {
  id: string;
  label: string;
  title: string;
  description: string;
  formula?: string;
  align?: 'left' | 'right';
  openId: string | null;
  setOpenId: (id: string | null) => void;
}

function ColumnHeaderTooltip({
  id,
  label,
  title,
  description,
  formula,
  align = 'right',
  openId,
  setOpenId,
}: ColumnTooltipProps) {
  const isOpen = openId === id;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenId(null);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenId(null);
    }
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, setOpenId]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center gap-1 ${
        align === 'right' ? 'justify-end' : 'justify-start'
      }`}
      onMouseEnter={() => setOpenId(id)}
      onMouseLeave={() => setOpenId(null)}
    >
      <button
        type="button"
        onClick={() => setOpenId(isOpen ? null : id)}
        onFocus={() => setOpenId(id)}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? `col-tip-${id}` : undefined}
        className="inline-flex items-center gap-1 font-medium text-stone-600 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A8A] rounded cursor-pointer group"
      >
        <span className="border-b border-dotted border-stone-400 group-hover:border-stone-800">
          {label}
        </span>
        <Info className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#1E3A8A] shrink-0" />
      </button>

      {isOpen && (
        <div
          id={`col-tip-${id}`}
          role="tooltip"
          className={`absolute top-full mt-2 w-64 p-3 bg-stone-900 text-[#FBF9F5] rounded-md shadow-lg border border-stone-700 text-left font-sans font-normal normal-case tracking-normal z-30 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <p className="text-xs font-semibold text-white">{title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-stone-200">{description}</p>
          {formula && (
            <p className="mt-2 pt-1.5 border-t border-stone-700 font-mono text-[10px] text-[#93C5FD]">
              {formula}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const FACTION_SUMMARIES: Record<FactionLane, string> = {
  'Pragmatic Center-Left':
    'Institutional New Dem / moderate coalitions (Cooper, Sand, Shapiro, Andrews) focused on Medicaid and cross-party competence.',
  'Economic Populist & Labor':
    'CWCP-style economic populists (Talarico, Hinojosa, Turek, Brown) pairing anti-corporate pocketbook fights with public school defense.',
  'Progressive Reformer':
    'Systemic reform and Sanders/CPC-aligned wings (El-Sayed, Markey, Flanagan, Merkley, Jackson); mostly ran in D+4 to D+25 states.',
  'Independent Populist':
    'Non-party challengers (Osborn in NE, Bodnar in MT, Achilles in ID) testing whether dropping the Democratic label helps in R+20+ states.',
  'GOP Resilience Hold':
    'Right-of-center holds (Donalds, Moody, Capito) emphasizing housing permitting, energy, and local growth.',
};

export function AffiliationPolicyAnalysis({
  benchmarkMode = 'unweighted',
  nationalAvgShift,
  demographicShifts = DEFAULT_NATIONAL_DEMOGRAPHIC_SHIFTS,
  factionOverrides = {},
  onChangeFaction,
  onResetFactions,
  onSelectState,
}: AffiliationPolicyAnalysisProps) {
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyPillar>('Trade & Tariffs');
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);
  const [hoveredMemberFaction, setHoveredMemberFaction] = useState<FactionLane | null>(null);
  const [expandedFactions, setExpandedFactions] = useState<Record<string, boolean>>({});
  const [assignmentFilterFaction, setAssignmentFilterFaction] = useState<FactionLane | 'All'>('All');
  const [assignmentSearch, setAssignmentSearch] = useState<string>('');
  const [isAssignmentTableOpen, setIsAssignmentTableOpen] = useState<boolean>(false);

  const effectiveUiRaces = useMemo(
    () =>
      STATEWIDE_RACES_2026.map((r) => ({
        ...r,
        faction: factionOverrides[r.id] ?? r.faction,
        defaultFaction: r.faction,
      })),
    [factionOverrides]
  );

  const effectiveRawRaces = useMemo(
    () =>
      RAW_RACES_2026.map((r) => ({
        ...r,
        faction: factionOverrides[r.id] ?? r.faction,
      })),
    [factionOverrides]
  );

  const defaultFactionByRaceId = useMemo(
    () => new Map(STATEWIDE_RACES_2026.map((r) => [r.id, r.faction])),
    []
  );

  const overrideCount = Object.keys(factionOverrides).length;

  const combinedMetrics = useMemo(
    () => computeCombinedAdjustedMetrics(RAW_RACES_2026, demographicShifts, benchmarkMode),
    [demographicShifts, benchmarkMode]
  );

  const combinedByRaceId = useMemo(
    () => new Map(combinedMetrics.map((m) => [m.race.id, m])),
    [combinedMetrics]
  );

  const combinedAdjustedMap = useMemo(
    () => new Map(combinedMetrics.map((m) => [m.race.id, m.adjustedDifference])),
    [combinedMetrics]
  );

  const logitAdjustedMap = useMemo(
    () => new Map(combinedMetrics.map((m) => [m.race.id, m.logitAdjustedResidual])),
    [combinedMetrics]
  );

  const factionStats = useMemo(() => {
    const raw = aggregateByFaction(
      effectiveRawRaces,
      nationalAvgShift,
      combinedAdjustedMap,
      logitAdjustedMap
    ).map((item) => {
      const members = effectiveUiRaces
        .filter((r) => r.faction === item.faction)
        .sort(
          (a, b) =>
            (combinedByRaceId.get(b.id)?.afterMeanResidual ?? 0) -
            (combinedByRaceId.get(a.id)?.afterMeanResidual ?? 0)
        );
      return {
        faction: item.faction,
        count: item.count,
        flips: item.flips,
        avgShift: item.avgShift,
        avgMeanAdjusted: item.avgResidual,
        avgLogitAdjusted: item.avgLogitAdjustedResidual,
        avgCombinedAdjusted: item.avgCombinedAdjustedResidual,
        avgBaseline: item.avgBaseline2024,
        members,
      };
    });
    return [...raw].sort((a, b) => b.avgMeanAdjusted - a.avgMeanAdjusted);
  }, [
    effectiveRawRaces,
    effectiveUiRaces,
    nationalAvgShift,
    combinedAdjustedMap,
    logitAdjustedMap,
    combinedByRaceId,
  ]);

  const filteredAssignmentRows = useMemo(() => {
    const q = assignmentSearch.trim().toLowerCase();
    return [...effectiveUiRaces]
      .filter((race) => {
        if (assignmentFilterFaction !== 'All' && race.faction !== assignmentFilterFaction) {
          return false;
        }
        if (!q) return true;
        return (
          race.featuredCandidate.toLowerCase().includes(q) ||
          race.stateCode.toLowerCase().includes(q) ||
          race.stateName.toLowerCase().includes(q) ||
          race.raceLabel.toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          (combinedByRaceId.get(b.id)?.afterMeanResidual ?? 0) -
          (combinedByRaceId.get(a.id)?.afterMeanResidual ?? 0)
      );
  }, [effectiveUiRaces, assignmentFilterFaction, assignmentSearch, combinedByRaceId]);

  const allExpanded = factionStats.every((f) => Boolean(expandedFactions[f.faction]));

  function toggleFactionExpanded(faction: FactionLane) {
    setExpandedFactions((prev) => ({
      ...prev,
      [faction]: !prev[faction],
    }));
  }

  function handleToggleAllFactions() {
    const nextState = !allExpanded;
    const updated: Record<string, boolean> = {};
    for (const f of factionStats) {
      updated[f.faction] = nextState;
    }
    setExpandedFactions(updated);
  }

  function handleExportCampsJson(targetFaction?: FactionLane) {
    const rows = targetFaction
      ? factionStats.filter((f) => f.faction === targetFaction)
      : factionStats;

    const payload = {
      generatedAt: new Date().toISOString(),
      benchmarkMode,
      nationalAverageShift: nationalAvgShift,
      demographicShiftsUsed: demographicShifts,
      camps: rows.map((row) => ({
        faction: row.faction,
        typologySummary: FACTION_SUMMARIES[row.faction],
        raceCount: row.count,
        flips: row.flips,
        avgBaseline2024: row.avgBaseline,
        avgRawDiff: row.avgShift,
        avgMeanAdjustedDiff: row.avgMeanAdjusted,
        avgLogitAdjustedDiff: row.avgLogitAdjusted,
        avgDemoAdjustedDiff: row.avgCombinedAdjusted,
        members: row.members.map((race) => {
          const metrics = combinedByRaceId.get(race.id);
          return {
            id: race.id,
            stateCode: race.stateCode,
            stateName: race.stateName,
            office: race.office,
            featuredCandidate: race.featuredCandidate,
            featuredParty: race.featuredParty,
            assignedFaction: race.faction,
            defaultFaction: defaultFactionByRaceId.get(race.id) ?? race.faction,
            reassignedFromDefault: Boolean(factionOverrides[race.id]),
            flipped: race.flipped,
            presMargin2024: race.presMargin2024,
            demOrCoalitionMargin2026: race.demOrCoalitionMargin2026,
            rawDiff: metrics?.rawShift ?? computeRaceShift(race),
            meanAdjustedDiff: metrics?.afterMeanResidual ?? 0,
            logitAdjustedDiff: metrics?.logitAdjustedResidual ?? 0,
            demographicTilt: metrics?.demographicWeight ?? 0,
            demoAdjustedDiff: metrics?.adjustedDifference ?? 0,
            policyPillars: race.policyPillars,
            sourceAttribution: race.sourceAttribution,
          };
        }),
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const slug = targetFaction
      ? targetFaction.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : 'all';
    link.href = url;
    link.download = `2026-ideological-camps-${slug}-${benchmarkMode}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const policyStats = useMemo(() => {
    const aggregates = aggregateByPolicy(
      RAW_RACES_2026,
      nationalAvgShift,
      undefined,
      combinedAdjustedMap,
      logitAdjustedMap
    );
    return POLICY_PILLARS.map((pillar) => {
      const agg = aggregates.find((a) => a.pillar === pillar.id);
      const matching = effectiveUiRaces.filter((r) => r.policyPillars.includes(pillar.id));
      return {
        ...pillar,
        races: matching,
        count: agg?.count ?? matching.length,
        flips: agg?.flips ?? 0,
        avgShift: agg?.avgShift ?? 0,
        avgMeanAdjusted: agg?.avgResidual ?? 0,
        avgLogitAdjusted: agg?.avgLogitAdjustedResidual ?? 0,
        avgCombinedAdjusted: agg?.avgCombinedAdjustedResidual ?? 0,
      };
    }).sort((a, b) => b.avgMeanAdjusted - a.avgMeanAdjusted);
  }, [nationalAvgShift, combinedAdjustedMap, logitAdjustedMap, effectiveUiRaces]);

  const activePolicy = policyStats.find((p) => p.id === selectedPolicy) ?? policyStats[0];

  const sortedMatchingRaces = useMemo(() => {
    return [...activePolicy.races].sort(
      (a, b) =>
        (combinedByRaceId.get(b.id)?.afterMeanResidual ?? 0) -
        (combinedByRaceId.get(a.id)?.afterMeanResidual ?? 0)
    );
  }, [activePolicy, combinedByRaceId]);

  return (
    <section id="affiliations" className="py-12 border-t border-stone-200 scroll-mt-20">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
          03 · Comparing Camps &amp; Policy Stances · Looking Past Labels
        </p>
        <h2 className="text-2xl sm:text-3xl font-display font-semibold text-stone-900 mt-1">
          Party Wing vs. Policy Stances: What Actually Moved Voters?
        </h2>
        <p className="text-sm text-stone-600 mt-2 max-w-3xl">
          With the national wave and state demographics stripped out, compare candidate
          affiliations alongside eight concrete campaign issue pillars.
        </p>
      </div>

      {/* Framework Attribution: Why These 5 Affiliation Groups? */}
      <div className="mb-8 p-5 bg-[#F5F2EB] border border-stone-200 rounded-lg">
        <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
          How These Five Camps Are Defined
        </p>
        <div className="mt-2.5 grid grid-cols-1 md:grid-cols-3 gap-5 text-xs sm:text-sm text-stone-700 leading-relaxed">
          <p>
            <strong className="text-stone-900">
              <a
                href="https://www.pewresearch.org/politics/2026/06/10/beyond-red-vs-blue-the-2026-political-typology/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] underline underline-offset-2"
              >
                Pew 2026 Typology
              </a>
              :
            </strong>{' '}
            Separates institutional coalitions (<strong>Pragmatic Center-Left</strong>) from
            systemic wings (<strong>Progressive Reformer</strong>) and GOP holds.
          </p>
          <p>
            <strong className="text-stone-900">
              <a
                href="https://workingclasspolitics.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] underline underline-offset-2"
              >
                CWCP Win-o-Meter
              </a>
              :
            </strong>{' '}
            Shows anti-corporate pocketbook campaigns perform distinctly, motivating separate{' '}
            <strong>Economic Populist</strong> and <strong>Independent</strong> lanes.
          </p>
          <p>
            <strong className="text-stone-900">
              <a
                href="https://split-ticket.org/full-wins-above-replacement-war-database/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] underline underline-offset-2"
              >
                Split Ticket WAR
              </a>
              :
            </strong>{' '}
            Benchmarks each camp by residual margin above state baseline and demographic tilt.
          </p>
        </div>
      </div>

      {/* Part A: Streamlined 5-Column Faction Comparison Table */}
      <div className="bg-white border border-stone-200 rounded-lg mb-10">
        <div className="px-6 py-4 border-b border-stone-200 rounded-t-lg flex flex-wrap items-center justify-between gap-3 bg-[#F7F4EE]">
          <div>
            <h3 className="text-lg font-display font-semibold text-stone-900">
              Raw vs. Demographic-Adjusted Performance by Ideological Camp
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Hover a camp&apos;s count to preview its roster, or click any row to expand all
              members.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleAllFactions}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-stone-300 rounded hover:border-stone-500 text-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {allExpanded ? 'Collapse All Camps' : 'Expand All Camps'}
            </button>
            <button
              type="button"
              onClick={() => handleExportCampsJson()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-stone-900 text-[#FBF9F5] hover:bg-stone-800 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>Export Camps JSON</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-stone-200 text-xs text-stone-500 bg-[#FBF9F5]">
                <th className="py-3 px-6 font-medium">
                  <ColumnHeaderTooltip
                    id="affiliation"
                    label="Affiliation Group"
                    title="Ideological Affiliation Lane"
                    description="Candidate camp mapped from primary/general endorsements, caucus ties, Pew 2026 Political Typology groupings, and CWCP economic-populist framing."
                    align="left"
                    openId={openTooltipId}
                    setOpenId={setOpenTooltipId}
                  />
                </th>
                <th className="py-3 px-4 font-medium text-right">
                  <ColumnHeaderTooltip
                    id="races-flips"
                    label="Races / Flips"
                    title="Contested Races & Party Flips"
                    description="Number of tracked 2026 Senate and Governor races in this camp, followed by seats that flipped party control. Hover the count below to preview members."
                    openId={openTooltipId}
                    setOpenId={setOpenTooltipId}
                  />
                </th>
                <th className="py-3 px-4 font-medium text-right">
                  <ColumnHeaderTooltip
                    id="base-2024"
                    label="2024 Base"
                    title="Mean 2024 Presidential Baseline"
                    description="Average certified 2024 presidential margin (Harris% − Trump%) across states where this camp fielded candidates. Negative (R+) means redder starting terrain."
                    formula="Mean(Harris% − Trump%)"
                    openId={openTooltipId}
                    setOpenId={setOpenTooltipId}
                  />
                </th>
                <th className="py-3 px-4 font-medium text-right">
                  <ColumnHeaderTooltip
                    id="raw-shift"
                    label="Raw Diff."
                    title="Raw Shift vs. 2024 Baseline"
                    description="Unadjusted average percentage-point swing toward the Democratic or non-GOP coalition candidate relative to 2024."
                    formula="Mean(Margin_2026 − Margin_2024)"
                    openId={openTooltipId}
                    setOpenId={setOpenTooltipId}
                  />
                </th>
                <th className="py-3 px-4 font-medium text-right">
                  <ColumnHeaderTooltip
                    id="mean-adj"
                    label="Mean-Adj."
                    title="Mean-Adjusted Difference (Default)"
                    description={`Average residual after subtracting only the National Mean Tide (+${nationalAvgShift.toFixed(1)} ${benchmarkMode === 'unweighted' ? 'unweighted' : 'ballot-weighted'}).`}
                    formula="Raw Diff. − National Mean Tide"
                    openId={openTooltipId}
                    setOpenId={setOpenTooltipId}
                  />
                </th>
                <th className="py-3 px-4 font-medium text-right">
                  <ColumnHeaderTooltip
                    id="logit-adj"
                    label="Logit-Adj."
                    title="Logit-Adjusted (Potential Gain)"
                    description="Potential-gain residual from fitting log-odds regression across all 42 races so safe seats with limited ceiling room aren't over-penalized."
                    formula="Margin_26 − invLogit(α + β·logit(Margin_24))"
                    openId={openTooltipId}
                    setOpenId={setOpenTooltipId}
                  />
                </th>
                <th className="py-3 px-6 font-medium text-right">
                  <ColumnHeaderTooltip
                    id="adjusted-diff"
                    label="Demo-Adj."
                    title="Demographic-Adjusted Difference"
                    description="Average candidate residual after subtracting both the National Mean Tide and each state's Pew/ACS demographic CVAP tilt."
                    formula="Raw Diff. − (Mean Tide + State Demo Tilt)"
                    openId={openTooltipId}
                    setOpenId={setOpenTooltipId}
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 text-sm">
              {factionStats.map((row, rowIdx) => {
                const isExpanded = Boolean(expandedFactions[row.faction]);
                const isHovered = hoveredMemberFaction === row.faction;
                const openUpward = rowIdx >= factionStats.length - 2;

                return (
                  <Fragment key={row.faction}>
                    <tr
                      onClick={() => toggleFactionExpanded(row.faction)}
                      aria-expanded={isExpanded}
                      className={`transition-colors cursor-pointer ${
                        isExpanded ? 'bg-[#EFECE5]/65' : 'hover:bg-stone-50/80'
                      }`}
                    >
                      <td className="py-4 px-6 max-w-md">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-stone-700 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-stone-500 shrink-0" />
                          )}
                          <span className="font-semibold text-stone-900">{row.faction}</span>
                        </div>
                        <span className="text-xs text-stone-600 leading-relaxed block mt-0.5 pl-6">
                          {FACTION_SUMMARIES[row.faction]}
                        </span>
                      </td>
                      <td
                        className="py-4 px-4 text-right font-mono tabular-nums text-stone-700 relative"
                        onMouseEnter={() => setHoveredMemberFaction(row.faction)}
                        onMouseLeave={() => setHoveredMemberFaction(null)}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFactionExpanded(row.faction);
                          }}
                          onFocus={() => setHoveredMemberFaction(row.faction)}
                          onBlur={() => setHoveredMemberFaction(null)}
                          className="inline-flex flex-col items-end cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A8A] rounded"
                        >
                          <span className="border-b border-dotted border-stone-400 hover:border-stone-800">
                            {row.count} / {row.flips}
                          </span>
                          <span className="text-[10px] font-sans text-[#1E3A8A] mt-0.5">
                            {isExpanded ? 'Hide members' : 'View members'}
                          </span>
                        </button>

                        {isHovered && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute right-4 w-72 sm:w-80 bg-stone-900 text-[#FBF9F5] rounded-md shadow-xl border border-stone-700 p-3 text-left font-sans z-30 ${
                              openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-stone-700">
                              <span className="text-xs font-semibold text-white">
                                {row.faction} ({row.count})
                              </span>
                              <span className="text-[10px] font-mono text-stone-300">
                                Click row to pin
                              </span>
                            </div>
                            <ul className="space-y-1 max-h-56 overflow-y-auto pr-1 text-[11px]">
                              {row.members.map((member) => {
                                const meanAdj =
                                  combinedByRaceId.get(member.id)?.afterMeanResidual ?? 0;
                                return (
                                  <li
                                    key={member.id}
                                    className="flex items-center justify-between gap-2"
                                  >
                                    <span className="text-stone-200 truncate">
                                      {member.featuredCandidate} ({member.stateCode}{' '}
                                      {member.office === 'Senate' ? 'Sen' : 'Gov'})
                                    </span>
                                    <span
                                      className={`font-mono tabular-nums shrink-0 ${
                                        meanAdj >= 0 ? 'text-[#5EEAD4]' : 'text-[#FDBA74]'
                                      }`}
                                    >
                                      {formatSignedMargin(meanAdj)}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right font-mono tabular-nums text-stone-600">
                        {row.avgBaseline >= 0
                          ? `D+${row.avgBaseline.toFixed(1)}`
                          : `R+${Math.abs(row.avgBaseline).toFixed(1)}`}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-semibold tabular-nums text-[#1E3A8A]">
                        {formatSignedMargin(row.avgShift)} pts
                      </td>
                      <td className="py-4 px-4 text-right font-mono tabular-nums">
                        <span
                          className={`font-semibold block ${
                            row.avgMeanAdjusted >= 0 ? 'text-stone-900' : 'text-[#9A3412]'
                          }`}
                        >
                          {formatSignedMargin(row.avgMeanAdjusted)} pts
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono tabular-nums">
                        <span
                          className={`font-semibold block ${
                            row.avgLogitAdjusted >= 0 ? 'text-[#4338CA]' : 'text-[#9A3412]'
                          }`}
                        >
                          {formatSignedMargin(row.avgLogitAdjusted)} pts
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-mono tabular-nums">
                        <span
                          className={`font-semibold block ${
                            row.avgCombinedAdjusted >= 0 ? 'text-[#0F766E]' : 'text-[#9A3412]'
                          }`}
                        >
                          {formatSignedMargin(row.avgCombinedAdjusted)} pts
                        </span>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-[#FBF9F5]">
                        <td colSpan={7} className="px-6 py-5 border-t border-stone-200">
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
                            <div>
                              <p className="text-xs uppercase tracking-wider text-stone-500 font-medium">
                                Complete {row.faction} Roster · {row.count} Contests (Ranked by
                                Mean-Adjusted Diff.)
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportCampsJson(row.faction);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-white border border-stone-300 rounded hover:border-stone-500 text-stone-800 transition-colors cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>Export {row.faction} JSON</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {row.members.map((member) => {
                              const metrics = combinedByRaceId.get(member.id);
                              const rawShift = metrics?.rawShift ?? computeRaceShift(member);
                              const meanAdj = metrics?.afterMeanResidual ?? 0;
                              const logitAdj = metrics?.logitAdjustedResidual ?? 0;
                              const adjDiff = metrics?.adjustedDifference ?? 0;

                              return (
                                <button
                                  key={member.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectState(member.stateCode);
                                    document
                                      .getElementById('state-map')
                                      ?.scrollIntoView({ behavior: 'smooth' });
                                  }}
                                  className="text-left p-3 rounded border border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50 transition-colors cursor-pointer flex flex-col justify-between"
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-semibold text-stone-900 truncate">
                                        {member.featuredCandidate} ({member.featuredParty}) ·{' '}
                                        {member.stateCode}{' '}
                                        {member.office === 'Senate' ? 'Sen' : 'Gov'}
                                      </span>
                                      <span
                                        className={`font-mono text-xs font-semibold tabular-nums shrink-0 ${
                                          meanAdj >= 0 ? 'text-[#0F766E]' : 'text-[#9A3412]'
                                        }`}
                                      >
                                        {formatSignedMargin(meanAdj)} mean
                                      </span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] text-stone-600 tabular-nums">
                                      <span>
                                        2024: {formatPartyMargin(member.presMargin2024)} →{' '}
                                        {formatPartyMargin(member.demOrCoalitionMargin2026)}
                                      </span>
                                      <span className="shrink-0">
                                        <span className="text-[#1E3A8A]">
                                          {formatSignedMargin(rawShift)}r
                                        </span>{' '}
                                        · {formatSignedMargin(logitAdj)}l ·{' '}
                                        {formatSignedMargin(adjDiff)}d
                                      </span>
                                    </div>
                                  </div>
                                  <p className="mt-2 pt-1.5 border-t border-stone-100 text-[10px] text-stone-500 truncate">
                                    {member.flipped ? 'Seat Flipped · ' : ''}
                                    {member.policyPillars.slice(0, 3).join(' · ')}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 bg-[#FBF9F5] border-t border-stone-200 rounded-b-lg text-xs text-stone-600 leading-relaxed">
          {(() => {
            const prog = factionStats.find((f) => f.faction === 'Progressive Reformer');
            const pop = factionStats.find((f) => f.faction === 'Economic Populist & Labor');
            const ctr = factionStats.find((f) => f.faction === 'Pragmatic Center-Left');
            const gop = factionStats.find((f) => f.faction === 'GOP Resilience Hold');
            return `Ranked by Mean-Adjusted Diff., Economic Populist & Labor (${formatSignedMargin(pop?.avgMeanAdjusted ?? 2.0)} pts, ${pop?.flips ?? 4} flips) and Pragmatic Center-Left (${formatSignedMargin(ctr?.avgMeanAdjusted ?? 1.9)} pts, ${ctr?.flips ?? 8} flips) finish virtually tied. Under Logit-Adjusted potential gain, Pragmatic Center-Left (${formatSignedMargin(ctr?.avgLogitAdjusted ?? 2.8)} pts) leads Economic Populist (${formatSignedMargin(pop?.avgLogitAdjusted ?? 1.1)} pts), while GOP Resilience Holds flip from ${formatSignedMargin(gop?.avgMeanAdjusted ?? 1.7)} mean to ${formatSignedMargin(gop?.avgLogitAdjusted ?? -1.4)} logit and Progressive Reformers narrow from ${formatSignedMargin(prog?.avgMeanAdjusted ?? -11.2)} to ${formatSignedMargin(prog?.avgLogitAdjusted ?? -8.1)}.`;
          })()}
        </div>
      </div>

      {/* Part A.2: Interactive Candidate Affiliation Assignment Table */}
      {onChangeFaction && (
        <div className="bg-white border border-stone-200 rounded-lg mb-10 overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200 bg-[#F7F4EE] flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-display font-semibold text-stone-900">
                  Reassign Candidate Affiliation Groups
                </h3>
                {overrideCount > 0 && (
                  <span className="font-mono text-xs text-[#1E3A8A] font-medium">
                    · {overrideCount} customized
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600 mt-0.5">
                Classify anyone differently? Switch any candidate&apos;s camp below—the group
                averages above, map tags, and Section 05 summary recalculate live.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {overrideCount > 0 && onResetFactions && (
                <button
                  type="button"
                  onClick={onResetFactions}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-stone-300 rounded hover:border-stone-500 text-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Defaults</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsAssignmentTableOpen((prev) => !prev)}
                aria-expanded={isAssignmentTableOpen}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-stone-300 rounded hover:border-stone-500 text-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isAssignmentTableOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <span>{isAssignmentTableOpen ? 'Hide Table' : 'Edit Assignments (42)'}</span>
              </button>
            </div>
          </div>

          {isAssignmentTableOpen && (
            <div>
              <div className="px-6 py-3 border-b border-stone-200 bg-[#FBF9F5] flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <label htmlFor="assign-filter-camp" className="text-stone-500">
                    Camp:
                  </label>
                  <select
                    id="assign-filter-camp"
                    value={assignmentFilterFaction}
                    onChange={(e) =>
                      setAssignmentFilterFaction(e.target.value as FactionLane | 'All')
                    }
                    className="bg-white border border-stone-300 rounded px-2.5 py-1.5 text-xs text-stone-800 focus:outline-2 focus:outline-[#1E3A8A]"
                  >
                    <option value="All">All Camps ({effectiveUiRaces.length})</option>
                    {ALL_FACTIONS.map((faction) => {
                      const count = effectiveUiRaces.filter((r) => r.faction === faction).length;
                      return (
                        <option key={faction} value={faction}>
                          {faction} ({count})
                        </option>
                      );
                    })}
                  </select>

                  <input
                    type="search"
                    aria-label="Filter candidates by name or state"
                    placeholder="Filter candidate or state..."
                    value={assignmentSearch}
                    onChange={(e) => setAssignmentSearch(e.target.value)}
                    className="bg-white border border-stone-300 rounded px-2.5 py-1.5 text-xs text-stone-800 placeholder:text-stone-400 w-48 sm:w-56 focus:outline-2 focus:outline-[#1E3A8A]"
                  />
                </div>
                <span className="text-[11px] font-mono text-stone-500 tabular-nums">
                  Showing {filteredAssignmentRows.length} of {effectiveUiRaces.length} candidates
                </span>
              </div>

              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left border-collapse min-w-[740px] text-xs sm:text-sm">
                  <thead className="sticky top-0 bg-[#FBF9F5] border-b border-stone-200 text-xs text-stone-500 z-10">
                    <tr>
                      <th className="py-2.5 px-6 font-medium">Candidate &amp; Race</th>
                      <th className="py-2.5 px-3 font-medium text-right">Raw Diff.</th>
                      <th className="py-2.5 px-3 font-medium text-right">Mean-Adj.</th>
                      <th className="py-2.5 px-3 font-medium text-right">Logit-Adj.</th>
                      <th className="py-2.5 px-3 font-medium text-right">Demo-Adj.</th>
                      <th className="py-2.5 px-6 font-medium text-right">Affiliation Group</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {filteredAssignmentRows.map((race) => {
                      const metrics = combinedByRaceId.get(race.id);
                      const rawShift = metrics?.rawShift ?? computeRaceShift(race);
                      const meanAdj = metrics?.afterMeanResidual ?? 0;
                      const logitAdj = metrics?.logitAdjustedResidual ?? 0;
                      const demoAdj = metrics?.adjustedDifference ?? 0;
                      const isOverridden = race.faction !== race.defaultFaction;

                      return (
                        <tr
                          key={race.id}
                          className={isOverridden ? 'bg-[#F5F2EB]/70' : 'hover:bg-stone-50/80'}
                        >
                          <td className="py-2.5 px-6">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectState(race.stateCode);
                                document
                                  .getElementById('state-map')
                                  ?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="text-left group cursor-pointer"
                            >
                              <span className="font-semibold text-stone-900 group-hover:text-[#1E3A8A] group-hover:underline underline-offset-2">
                                {race.featuredCandidate} ({race.featuredParty}) · {race.stateCode}{' '}
                                {race.office === 'Senate' ? 'Sen' : 'Gov'}
                              </span>
                              <span className="block text-[11px] text-stone-500 font-mono tabular-nums">
                                2024: {formatPartyMargin(race.presMargin2024)} →{' '}
                                {formatPartyMargin(race.demOrCoalitionMargin2026)}
                                {race.flipped ? ' · Flipped' : ''}
                              </span>
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#1E3A8A]">
                            {formatSignedMargin(rawShift)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-semibold tabular-nums ${
                              meanAdj >= 0 ? 'text-stone-900' : 'text-[#9A3412]'
                            }`}
                          >
                            {formatSignedMargin(meanAdj)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                              logitAdj >= 0 ? 'text-[#4338CA]' : 'text-[#9A3412]'
                            }`}
                          >
                            {formatSignedMargin(logitAdj)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                              demoAdj >= 0 ? 'text-[#0F766E]' : 'text-[#9A3412]'
                            }`}
                          >
                            {formatSignedMargin(demoAdj)}
                          </td>
                          <td className="py-2.5 px-6 text-right">
                            <div className="inline-flex flex-col items-end gap-1">
                              <select
                                aria-label={`Affiliation group for ${race.featuredCandidate} (${race.id})`}
                                value={race.faction}
                                onChange={(e) =>
                                  onChangeFaction(race.id, e.target.value as FactionLane)
                                }
                                className={`bg-white border rounded px-2.5 py-1.5 text-xs text-stone-900 focus:outline-2 focus:outline-[#1E3A8A] cursor-pointer ${
                                  isOverridden
                                    ? 'border-[#1E3A8A] font-medium'
                                    : 'border-stone-300'
                                }`}
                              >
                                {ALL_FACTIONS.map((faction) => (
                                  <option key={faction} value={faction}>
                                    {faction}
                                  </option>
                                ))}
                              </select>
                              {isOverridden && (
                                <span className="text-[10px] text-stone-500">
                                  Default: {race.defaultFaction}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredAssignmentRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 px-6 text-center text-xs text-stone-500">
                          No candidates match the current filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Policy Pillar Attribution Box */}
      <div className="mb-8 p-5 bg-[#F5F2EB] border border-stone-200 rounded-lg">
        <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
          Where These Eight Policy Pillars Come From
        </p>
        <div className="mt-2.5 grid grid-cols-1 md:grid-cols-3 gap-5 text-xs sm:text-sm text-stone-700 leading-relaxed">
          <p>
            <strong className="text-stone-900">
              Exit-Poll Salience (
              <a
                href="https://ssrs.com/the-voter-poll-by-ssrs/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] underline underline-offset-2"
              >
                SSRS
              </a>
              ,{' '}
              <a
                href="https://www.brookings.edu/articles/the-midterm-effect-what-the-2026-election-could-mean-for-public-policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] underline underline-offset-2"
              >
                Brookings
              </a>
              ):
            </strong>{' '}
            Mirrors the top 2026 voter issues—inflation, Medicaid, tariffs, permitting, and
            reproductive rights.
          </p>
          <p>
            <strong className="text-stone-900">
              Campaign Platforms (
              <a
                href="https://ballotpedia.org/United_States_Senate_elections,_2026"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] underline underline-offset-2"
              >
                Ballotpedia
              </a>
              ,{' '}
              <a
                href="https://apnews.com/hub/2026-midterm-election"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] underline underline-offset-2"
              >
                AP
              </a>
              ):
            </strong>{' '}
            Tags come directly from official candidate issue pages, debates, and Cook/AP race
            profiles.
          </p>
          <p>
            <strong className="text-stone-900">Cross-Wing Issue Overlap:</strong> Each race carries{' '}
            <strong>2–4 pillars</strong>, letting us test whether concrete stances beat party
            labels.
          </p>
        </div>
      </div>

      {/* Part B: Interactive Policy Stance Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-5 bg-[#F5F2EB] border border-stone-200 rounded-lg p-5 sm:p-6">
          <p className="text-xs uppercase tracking-widest text-stone-500 font-medium mb-3">
            Select a Campaign Policy Pillar
          </p>
          <div className="space-y-1.5">
            {policyStats.map((pillar) => {
              const isActive = pillar.id === activePolicy.id;
              return (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => setSelectedPolicy(pillar.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded border transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                    isActive
                      ? 'bg-stone-900 text-[#FBF9F5] border-stone-900'
                      : 'bg-white text-stone-800 border-stone-200 hover:border-stone-400'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium block truncate">{pillar.id}</span>
                    <span
                      className={`text-[11px] block ${
                        isActive ? 'text-stone-300' : 'text-stone-500'
                      }`}
                    >
                      {pillar.count} races · {pillar.flips} flips ·{' '}
                      {formatSignedMargin(pillar.avgLogitAdjusted)} logit ·{' '}
                      {formatSignedMargin(pillar.avgShift)} raw ·{' '}
                      {formatSignedMargin(pillar.avgCombinedAdjusted)} demo
                    </span>
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums shrink-0">
                    <span
                      className={`font-semibold block ${
                        isActive
                          ? 'text-[#93C5FD]'
                          : pillar.avgMeanAdjusted >= 0
                          ? 'text-[#0F766E]'
                          : 'text-[#9A3412]'
                      }`}
                    >
                      {formatSignedMargin(pillar.avgMeanAdjusted)} mean
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-stone-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-stone-200">
              <div>
                <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
                  Policy Coalition Profile
                </p>
                <h3 className="text-2xl font-display font-semibold text-stone-900 mt-0.5">
                  {activePolicy.id}
                </h3>
              </div>
              <div className="text-right font-mono tabular-nums">
                <span className="block text-[11px] text-stone-500">
                  Mean-Adj. / Logit-Adj. / Raw / Demo-Adj.
                </span>
                <span
                  className={`text-sm font-semibold ${
                    activePolicy.avgMeanAdjusted >= 0 ? 'text-stone-900' : 'text-[#9A3412]'
                  }`}
                >
                  {formatSignedMargin(activePolicy.avgMeanAdjusted)}
                </span>{' '}
                <span className="text-stone-400">/</span>{' '}
                <span
                  className={`text-sm font-semibold ${
                    activePolicy.avgLogitAdjusted >= 0 ? 'text-[#4338CA]' : 'text-[#9A3412]'
                  }`}
                >
                  {formatSignedMargin(activePolicy.avgLogitAdjusted)}
                </span>{' '}
                <span className="text-stone-400">/</span>{' '}
                <span className="text-sm font-semibold text-[#1E3A8A]">
                  {formatSignedMargin(activePolicy.avgShift)}
                </span>{' '}
                <span className="text-stone-400">/</span>{' '}
                <span
                  className={`text-sm font-semibold ${
                    activePolicy.avgCombinedAdjusted >= 0 ? 'text-[#0F766E]' : 'text-[#9A3412]'
                  }`}
                >
                  {formatSignedMargin(activePolicy.avgCombinedAdjusted)}
                </span>
              </div>
            </div>

            <p className="mt-4 text-sm text-stone-700 leading-relaxed">{activePolicy.description}</p>
            <p className="mt-2.5 text-sm text-stone-700 leading-relaxed bg-[#F7F4EE] border border-stone-200/80 rounded p-3.5">
              <strong className="font-semibold text-stone-900">2028 Signal: </strong>
              {activePolicy.outlook2028}
            </p>

            <div className="mt-5">
              <h4 className="text-xs uppercase tracking-wider text-stone-500 font-medium mb-2.5">
                Candidates Emphasizing This Pillar (Ranked by Mean-Adjusted Diff.)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
                {sortedMatchingRaces.map((race) => {
                  const metrics = combinedByRaceId.get(race.id);
                  const shift = metrics?.rawShift ?? computeRaceShift(race);
                  const meanAdj = metrics?.afterMeanResidual ?? 0;
                  const logitAdj = metrics?.logitAdjustedResidual ?? 0;
                  const adjDiff = metrics?.adjustedDifference ?? 0;

                  return (
                    <button
                      key={race.id}
                      type="button"
                      onClick={() => {
                        onSelectState(race.stateCode);
                        document.getElementById('state-map')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="text-left p-3 rounded border border-stone-200 hover:border-stone-400 hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-stone-900 truncate">
                          {race.featuredCandidate} ({race.stateCode}{' '}
                          {race.office === 'Senate' ? 'Sen' : 'Gov'})
                        </span>
                        <span
                          className={`font-mono text-xs font-semibold tabular-nums shrink-0 ${
                            meanAdj >= 0 ? 'text-[#0F766E]' : 'text-[#9A3412]'
                          }`}
                        >
                          {formatSignedMargin(meanAdj)} mean
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-stone-500">
                        <span className="truncate">{race.faction}</span>
                        <span className="font-mono tabular-nums shrink-0">
                          {formatSignedMargin(logitAdj)} logit · {formatSignedMargin(shift)} raw ·{' '}
                          {formatSignedMargin(adjDiff)} demo
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
