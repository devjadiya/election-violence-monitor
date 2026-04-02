import Link from 'next/link'
import { prisma } from '@/lib/db'

async function getPublicStats() {
  try {
    const [incidents, fatalities, injured, countries] = await Promise.all([
      prisma.incident.count({ where: { status: 'PUBLISHED' } }),
      prisma.incident.aggregate({ where: { status: 'PUBLISHED' }, _sum: { fatalities: true } }),
      prisma.incident.aggregate({ where: { status: 'PUBLISHED' }, _sum: { injured: true } }),
      prisma.incident.groupBy({ by: ['country'], where: { status: 'PUBLISHED' } }),
    ])
    return {
      incidents,
      fatalities: fatalities._sum.fatalities ?? 0,
      injured: injured._sum.injured ?? 0,
      countries: countries.length,
    }
  } catch {
    return { incidents: 0, fatalities: 0, injured: 0, countries: 0 }
  }
}

export default async function HomePage() {
  const stats = await getPublicStats()

  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="glass-nav fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1a1a2e] flex items-center justify-center">
              <span className="text-white text-xs font-bold">EV</span>
            </div>
            <span className="font-semibold text-[#1a1a2e] tracking-tight">Election Violence Monitor</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/map" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors px-3 py-1.5">Live Map</Link>
            <Link href="/reports" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors px-3 py-1.5">Reports</Link>
            <Link href="/submit" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors px-3 py-1.5">Submit Tip</Link>
            <Link href="/login" className="text-sm bg-[#1a1a2e] text-white px-4 py-2 rounded-lg hover:bg-[#16213e] transition-colors font-medium">Sign In</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6 border border-blue-100">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Live Monitoring Active
          </div>
          <h1 className="heading-display text-[#1a1a2e] mb-6">
            Transparent Documentation of{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">
              Election Violence
            </span>
          </h1>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            A community-based platform for structured, ethical documentation of election-related violence incidents — supporting democracy, accountability, and research worldwide.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/map" className="bg-[#1a1a2e] text-white px-8 py-3.5 rounded-xl font-medium hover:bg-[#16213e] transition-all hover:shadow-lg hover:shadow-blue-900/10 hover:-translate-y-0.5">
              View Live Map
            </Link>
            <Link href="/reports" className="bg-white border border-zinc-200 text-zinc-700 px-8 py-3.5 rounded-xl font-medium hover:border-zinc-300 hover:shadow-sm transition-all">
              Browse Reports
            </Link>
          </div>
        </div>
      </section>

      {/* Live Stats */}
      <section className="py-16 px-6 bg-zinc-50/50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Incidents Documented', value: stats.incidents.toLocaleString(), sub: 'Verified & published', color: 'text-[#1a1a2e]' },
              { label: 'Countries Monitored', value: stats.countries.toLocaleString(), sub: 'Active coverage', color: 'text-blue-600' },
              { label: 'Fatalities Recorded', value: stats.fatalities.toLocaleString(), sub: 'Confirmed deaths', color: 'text-red-600' },
              { label: 'People Injured', value: stats.injured.toLocaleString(), sub: 'Reported injuries', color: 'text-orange-500' },
            ].map(stat => (
              <div key={stat.label} className="glass-card p-6 text-center">
                <div className={`stat-number ${stat.color} mb-1`}>{stat.value}</div>
                <div className="text-sm font-medium text-zinc-700 mb-0.5">{stat.label}</div>
                <div className="text-xs text-zinc-400">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="heading-xl text-[#1a1a2e] text-center mb-4">Built for Accountability</h2>
          <p className="text-zinc-500 text-center mb-12 max-w-xl mx-auto">Every feature designed with ethical documentation and public safety in mind.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '🗺️', title: 'Interactive Map', desc: 'Real-time geographic visualization of incidents with filtering by type, date, and election stage.' },
              { icon: '🤖', title: 'AI Classification', desc: 'Gemini-powered two-pass detection — first screening for relevance, then deep structured extraction.' },
              { icon: '🔍', title: 'Human Verification', desc: 'Every incident reviewed by trained analysts before publication. Confidence scores shown.' },
              { icon: '📊', title: 'Analytics Dashboard', desc: 'Trend charts, category breakdowns, geographic heatmaps, and exportable datasets.' },
              { icon: '🔒', title: 'Privacy First', desc: 'Victim names anonymized by default. Public view shows only aggregate data. RBAC access control.' },
              { icon: '🌍', title: 'Wikidata Integration', desc: 'Incidents linked to Wikidata entities — elections, locations, political parties — for research use.' },
            ].map(f => (
              <div key={f.title} className="glass-card p-6">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="heading-lg mb-2 text-[#1a1a2e]">{f.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-[#1a1a2e]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Witnessed election violence?</h2>
          <p className="text-white/60 mb-6 text-sm">Submit an anonymous, confidential tip. Our team will verify and document it ethically.</p>
          <Link href="/submit" className="inline-block bg-white text-[#1a1a2e] px-8 py-3 rounded-xl font-medium hover:bg-zinc-100 transition-colors">
            Submit a Tip →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#1a1a2e] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">EV</span>
            </div>
            <span className="text-sm text-zinc-500">Election Violence Monitor</span>
          </div>
          <div className="flex gap-6 text-xs text-zinc-400">
            <Link href="/about" className="hover:text-zinc-600 transition-colors">About</Link>
            <Link href="/reports" className="hover:text-zinc-600 transition-colors">Reports</Link>
            <Link href="/map" className="hover:text-zinc-600 transition-colors">Map</Link>
            <Link href="/submit" className="hover:text-zinc-600 transition-colors">Submit Tip</Link>
            <a href="https://github.com/devjadiya/election-violence-monitor" className="hover:text-zinc-600 transition-colors">GitHub</a>
          </div>
          <p className="text-xs text-zinc-400">Open source · CC0 License · Built for democracy</p>
        </div>
      </footer>
    </main>
  )
}