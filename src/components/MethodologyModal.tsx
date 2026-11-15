import { ExternalLink, X } from 'lucide-react';
import { useEffect } from 'react';
import { PRIMARY_DATA_SOURCES, SourceCategory } from '../data/electionData';

interface MethodologyModalProps {
  open: boolean;
  onClose: () => void;
  unweightedAvg: number;
  weightedAvg: number;
  raceCount: number;
}

const CATEGORIES: SourceCategory[] = [
  '2024 Certified Baseline',
  '2026 Vote Totals & Race Calls',
  'Exit Polls & 2028 Analysis',
];

export function MethodologyModal({
  open,
  onClose,
  unweightedAvg,
  weightedAvg,
  raceCount,
}: MethodologyModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="methodology-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-[#FBF9F5] border border-stone-300 rounded-lg p-6 sm:p-8 shadow-xl text-stone-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-200">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-500 font-medium">
              Aggregation Pipeline &amp; Primary Source Registry
            </p>
            <h2 id="methodology-title" className="text-2xl font-display font-semibold text-stone-900 mt-1">
              How the Primary Data Was Aggregated &amp; Modeled
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close methodology dialog"
            className="p-2 text-stone-500 hover:text-stone-900 rounded-md hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-stone-700">
          <div>
            <h3 className="font-sans font-semibold text-stone-900 text-sm mb-1.5">
              Step 1 · Baseline Extraction &amp; Normalization (2024 Presidential Vote)
            </h3>
            <p>
              Certified November 5, 2024 state-by-state presidential results from the{' '}
              <a
                href="https://www.archives.gov/electoral-college/2024"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] underline underline-offset-2"
              >
                National Archives (NARA)
              </a>{' '}
              and{' '}
              <a
                href="https://www.presidency.ucsb.edu/statistics/elections/2024"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] underline underline-offset-2"
              >
                UC Santa Barbara American Presidency Project
              </a>{' '}
              were normalized onto a single continuous scale:{' '}
              <code className="font-mono text-xs bg-[#F2EFE9] px-1.5 py-0.5 rounded">
                Margin_2024 = Harris % − Trump %
              </code>{' '}
              (so D+ margins are positive and R+ margins are negative).
            </p>
          </div>

          <div>
            <h3 className="font-sans font-semibold text-stone-900 text-sm mb-1.5">
              Step 2 · 2026 Contest Ingestion &amp; Cross-Verification
            </h3>
            <p>
              November 3, 2026 U.S. Senate and Gubernatorial vote shares were ingested from{' '}
              <a
                href="https://apnews.com/hub/2026-midterm-election"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] underline underline-offset-2"
              >
                Associated Press
              </a>
              ,{' '}
              <a
                href="https://results.decisiondeskhq.com/2026/general"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] underline underline-offset-2"
              >
                Decision Desk HQ
              </a>
              ,{' '}
              <a
                href="https://ballotpedia.org/United_States_Senate_elections,_2026"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] underline underline-offset-2"
              >
                Ballotpedia
              </a>
              , and{' '}
              <a
                href="https://www.multistate.us/elections/2026/results"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] underline underline-offset-2"
              >
                MultiState
              </a>
              . Each of the <span className="font-mono tabular-nums font-medium">{raceCount}</span>{' '}
              contested races was converted to a signed margin{' '}
              <code className="font-mono text-xs bg-[#F2EFE9] px-1.5 py-0.5 rounded">
                Margin_2026 = Non-GOP Lead % − GOP %
              </code>
              . Special edge cases:
            </p>
            <ul className="mt-2 space-y-1 list-disc pl-5 text-xs text-stone-600">
              <li>
                <strong>Independent Challengers (NE, ID):</strong> Where no Democrat appeared or an
                independent led the opposition coalition (Dan Osborn in NE, Todd Achilles in ID),
                margins compare the primary independent directly against the Republican nominee.
              </li>
              <li>
                <strong>Three-Way Split (MT):</strong> Measured using the top-two spread between
                Kurt Alme (R, 48.2%) and Independent Seth Bodnar (37.7%), yielding R+10.5.
              </li>
              <li>
                <strong>Ranked-Choice Tabulation (AK):</strong> Uses reported AP / NPR RCV totals
                for Mary Peltola (D, 49.8%) vs. Dan Sullivan (R, 46.1%).
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-sans font-semibold text-stone-900 text-sm mb-1.5">
              Step 3 · Dual Benchmark Aggregation (Unweighted vs. Vote-Weighted)
            </h3>
            <p>
              For each contest <em>i</em>, partisan shift is{' '}
              <code className="font-mono text-xs bg-[#F2EFE9] px-1.5 py-0.5 rounded">
                Shift_i = Margin_2026,i − Margin_2024,i
              </code>
              . We aggregate those shifts into two live benchmarks:
            </p>
            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-[#F2EFE9] border border-stone-200 rounded">
                <span className="block text-[11px] uppercase tracking-wider text-stone-500">
                  Unweighted State Mean
                </span>
                <span className="block font-mono text-sm font-semibold text-[#1E3A8A] mt-0.5 tabular-nums">
                  (1/N) × Σ Shift_i = +{unweightedAvg.toFixed(1)} pts
                </span>
                <span className="block text-[11px] text-stone-600 mt-1">
                  Treats each statewide electorate equally to measure candidate strength per state.
                </span>
              </div>
              <div className="p-3 bg-[#F2EFE9] border border-stone-200 rounded">
                <span className="block text-[11px] uppercase tracking-wider text-stone-500">
                  Ballot-Weighted Mean
                </span>
                <span className="block font-mono text-sm font-semibold text-[#1E3A8A] mt-0.5 tabular-nums">
                  Σ(Votes_i × Shift_i) / Σ Votes_i = +{weightedAvg.toFixed(1)} pts
                </span>
                <span className="block text-[11px] text-stone-600 mt-1">
                  Weights each race by total 2026 ballots cast (in millions).
                </span>
              </div>
            </div>
            <p className="mt-2.5 text-xs text-stone-600">
              Note: Statewide Senate and Governor averages (+14 to +16 pts) exceed the national U.S.
              House popular vote swing (~+7 to +9 pts per AP) because several safe Republican states
              compressed sharply down-ballot while states with no 2026 Senate/Governor race are
              excluded from the statewide mean.
            </p>
          </div>

          <div>
            <h3 className="font-sans font-semibold text-stone-900 text-sm mb-1.5">
              Step 4 · Demographic-Adjusted Difference
            </h3>
            <p>
              To separate candidate performance from both the national wave and state demographics,{' '}
              <code className="font-mono text-xs bg-[#F2EFE9] px-1.5 py-0.5 rounded">
                src/analysis/demographicModel.ts
              </code>{' '}
              combines two structural benchmarks: <strong>(1) National Mean Tide</strong> (mean
              2026-vs-2024 swing across tracked races) and{' '}
              <strong>(2) Demographic CVAP Tilt</strong> (Pew/ACS state eligible-voter shares ×
              national exit-poll group swings minus the tracked-state demographic mean). Subtracting
              both from each race&apos;s raw swing yields its{' '}
              <strong>Demographic-Adjusted Difference</strong>.
            </p>
          </div>

          <div>
            <h3 className="font-sans font-semibold text-stone-900 text-sm mb-1.5">
              Step 5 · Camp Typology, Policy Pillars &amp; Open-Source Modules
            </h3>
            <p>
              State-by-state demographic breakdowns (+4.0 White, +28.5 Hispanic, +8.0 Black, +9.0
              Asian, +8.5 Other exit-poll parameter vector) sit in Section 04. Candidate lanes
              follow Pew&apos;s 2026 Political Typology, CWCP economic-populism definitions, and
              Split Ticket WAR benchmarking. The eight Policy Pillars synthesize top voter-salience
              issues from SSRS, Pew, and Brookings exit analyses with each candidate&apos;s verified
              campaign platform commitments across Ballotpedia, AP, and Cook Political Report. All
              pure calculations live in{' '}
              <code className="font-mono text-xs bg-[#F2EFE9] px-1.5 py-0.5 rounded">
                src/analysis/
              </code>{' '}
              with zero UI dependencies.
            </p>
          </div>

          <div className="pt-5 border-t border-stone-200">
            <h3 className="font-sans font-semibold text-stone-900 text-sm mb-3">
              Complete Primary Data Source Links ({PRIMARY_DATA_SOURCES.length})
            </h3>
            <div className="space-y-4">
              {CATEGORIES.map((cat) => (
                <div key={cat}>
                  <p className="text-xs uppercase tracking-wider text-stone-500 font-medium mb-2">
                    {cat}
                  </p>
                  <ul className="space-y-2">
                    {PRIMARY_DATA_SOURCES.filter((s) => s.category === cat).map((src) => (
                      <li
                        key={src.id}
                        className="p-3 bg-white border border-stone-200 rounded text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[#1E3A8A] hover:underline inline-flex items-center gap-1"
                          >
                            <span>
                              {src.organization} — {src.name}
                            </span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </div>
                        <p className="text-stone-600 mt-1">{src.aggregationRole}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
