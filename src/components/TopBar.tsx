interface TopBarProps {
  onOpenMethodology: () => void;
}

export function TopBar({ onOpenMethodology }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#FBF9F5]/95 backdrop-blur-sm border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        <a
          href="#top"
          className="font-display text-xl font-semibold tracking-tight text-stone-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1E3A8A]"
        >
          The 2026 Ledger
        </a>

        <nav
          aria-label="Article sections"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600"
        >
          <a
            href="#state-map"
            className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            State Map
          </a>
          <a
            href="#overperformance"
            className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Raw vs. Adjusted
          </a>
          <a
            href="#affiliations"
            className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Camps &amp; Policy
          </a>
          <a
            href="#demographics"
            className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Demographics
          </a>
          <a
            href="#outlook-2028"
            className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Summary
          </a>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenMethodology}
            className="px-4 py-2 text-xs font-medium text-[#FBF9F5] bg-stone-900 hover:bg-stone-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A8A]"
          >
            Methodology
          </button>
        </div>
      </div>
    </header>
  );
}
