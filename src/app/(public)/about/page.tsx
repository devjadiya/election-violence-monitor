import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="glass-nav fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1a1a2e] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">EV</span>
            </div>
            <span className="font-semibold text-[#1a1a2e] text-sm">Election Violence Monitor</span>
          </Link>
          <Link href="/login" className="text-sm bg-[#1a1a2e] text-white px-3 py-1.5 rounded-lg font-medium">Sign In</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-16">
        <h1 className="heading-xl text-[#1a1a2e] mb-4">About This Project</h1>
        <div className="prose prose-zinc max-w-none space-y-4 text-zinc-600 text-sm leading-relaxed">
          <p>The Election Violence Monitor is a community-based platform for the systematic documentation of election-related violence incidents. It is designed to support transparency, accountability, and evidence-based research on electoral security challenges.</p>
          <h2 className="text-base font-semibold text-zinc-800 mt-6">Our Approach</h2>
          <p>Every incident is detected through AI-assisted screening of trusted news sources and observer reports, then reviewed by trained analysts before publication. We use a two-pass AI verification system powered by Google Gemini to classify incidents and extract structured data.</p>
          <h2 className="text-base font-semibold text-zinc-800 mt-6">Ethical Guidelines</h2>
          <p>We follow strict ethical guidelines: victim names are never published, personal identifiers are anonymized, and sensitive demographic data is excluded from all public exports. We rely only on credible, verifiable sources.</p>
          <h2 className="text-base font-semibold text-zinc-800 mt-6">Data & Wikidata</h2>
          <p>All published incidents are linked to Wikidata entities where possible — elections, locations, political parties — making our data interoperable with the broader open knowledge ecosystem.</p>
          <h2 className="text-base font-semibold text-zinc-800 mt-6">Open Source</h2>
          <p>This project is open source. The codebase, data schemas, and documentation are freely available for researchers, civil society organizations, and election monitoring bodies.</p>
        </div>

        <div className="mt-10 flex gap-3">
          <Link href="/map" className="bg-[#1a1a2e] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#16213e] transition-colors">
            View Live Map
          </Link>
          <Link href="/reports" className="border border-zinc-200 text-zinc-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors">
            Browse Reports
          </Link>
        </div>
      </div>
    </div>
  )
}