import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { publicIncidentFilter } from '@/lib/incidents/visibility'

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn about the Election Violence Monitor methodology, ethics, and data policy.',
}

export const dynamic = 'force-dynamic'

export default async function AboutPage() {
  const stats = await prisma.incident.aggregate({
    where: publicIncidentFilter(),
    _count: true,
    _sum: { fatalities: true, injured: true },
  }).catch(() => ({ _count: 0, _sum: { fatalities: 0, injured: 0 } }))

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
          <div className="flex items-center gap-4">
            <Link href="/reports" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">Reports</Link>
            <Link href="/map" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">Map</Link>
            <Link href="/login" className="text-sm bg-[#1a1a2e] text-white px-3 py-1.5 rounded-lg font-medium">Sign In</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-[#1a1a2e] mb-4 leading-tight">
            About the Election Violence Monitor
          </h1>
          <p className="text-lg text-zinc-500 leading-relaxed max-w-2xl">
            A community-based platform for the structured, ethical documentation of election-related violence incidents — supporting democracy, accountability, and evidence-based research worldwide.
          </p>
        </div>

        {/* Live stats */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { label: 'Documented Incidents', value: stats._count.toString() },
            { label: 'Fatalities Recorded', value: (stats._sum.fatalities ?? 0).toString() },
            { label: 'People Injured', value: (stats._sum.injured ?? 0).toString() },
          ].map(s => (
            <div key={s.label} className="glass-card p-5 text-center">
              <div className="text-3xl font-bold text-[#1a1a2e] mb-1">{s.value}</div>
              <div className="text-xs text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="space-y-10">
          {/* Mission */}
          <section>
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-3">Our Mission</h2>
            <div className="text-sm text-zinc-600 leading-relaxed space-y-3">
              <p>
                Elections are a vital component of democratic governance. However, in many countries, elections are accompanied by violence that disrupts the electoral process, intimidates voters, and undermines public confidence in democratic institutions. Election-related violence may occur at different stages of the electoral cycle — during campaigns, on election day, during vote counting, and after results are announced.
              </p>
              <p>
                The Election Violence Monitor exists to document these incidents in a structured, transparent, and ethical manner. We are not a court, a political body, or an attribution mechanism. We flag incidents for monitoring purposes to support transparency, research, and accountability — without making legal determinations or political judgments.
              </p>
            </div>
          </section>

          {/* What we document */}
          <section>
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-3">What We Document</h2>
            <p className="text-sm text-zinc-500 mb-4">We track 10 categories of election-related violence:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { icon: '👊', label: 'Physical Assault', desc: 'Direct attacks on voters, candidates, officials, journalists' },
                { icon: '🔫', label: 'Armed Attacks', desc: 'Shootings, armed clashes, weapons use near elections' },
                { icon: '😰', label: 'Voter Intimidation', desc: 'Threats, harassment, coercion of voters' },
                { icon: '⚔️', label: 'Party Clashes', desc: 'Violence between rival political party supporters' },
                { icon: '🗳️', label: 'Polling Disruption', desc: 'Ballot box snatching, voting interference' },
                { icon: '🏛️', label: 'Infrastructure Attack', desc: 'Electoral office vandalism, equipment destruction' },
                { icon: '💥', label: 'Property Damage', desc: 'Vehicles, billboards, campaign offices destroyed' },
                { icon: '🛡️', label: 'Security Misconduct', desc: 'Excessive force, unlawful arrests by security forces' },
                { icon: '🚨', label: 'Kidnapping', desc: 'Abduction of candidates, officials, activists' },
                { icon: '🔥', label: 'Post-Election Violence', desc: 'Protests, riots, attacks after results announced' },
              ].map(cat => (
                <div key={cat.label} className="glass-card p-3">
                  <div className="text-lg mb-1">{cat.icon}</div>
                  <div className="text-xs font-semibold text-zinc-700 mb-0.5">{cat.label}</div>
                  <div className="text-[10px] text-zinc-400 leading-relaxed">{cat.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Methodology */}
          <section>
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-3">How We Work</h2>
            <div className="space-y-4">
              {[
                {
                  step: '01',
                  title: 'Detection',
                  desc: 'Our AI pipeline (Google Gemini) scans trusted news sources — RSS feeds from verified outlets and the GDELT global event dataset — daily. Pass 1 screens for election + violence relevance. Pass 2 extracts structured fields: location, category, stage, impact.',
                },
                {
                  step: '02',
                  title: 'Human Review',
                  desc: 'Every AI-detected incident is flagged for human review before publication. Trained analysts verify the report against the original source. An incident cannot be published without human sign-off. There is no automated publishing.',
                },
                {
                  step: '03',
                  title: 'Source Citation',
                  desc: 'Every published incident must reference at least one credible public source — a news report, observer statement, or official record. The source is always cited and linked.',
                },
                {
                  step: '04',
                  title: 'Confidence Scoring',
                  desc: 'Each incident carries an AI confidence score (0–100%) reflecting how clearly the source material supports the classification. Low-confidence incidents are flagged and held for additional review.',
                },
                {
                  step: '05',
                  title: 'Publication',
                  desc: 'Once verified, incidents are published to the public database and become accessible via the public API, map, and reports page. Published records are immutable unless new information requires a correction, which is logged in the audit trail.',
                },
              ].map(item => (
                <div key={item.step} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#1a1a2e] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {item.step}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-800 mb-1">{item.title}</div>
                    <div className="text-sm text-zinc-500 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Ethical framework */}
          <section>
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-3">Ethical Framework</h2>
            <div className="glass-card p-5 space-y-4">
              {[
                {
                  title: 'Do No Harm',
                  desc: 'We never publish the names, photographs, or identifying details of victims, witnesses, or individuals who may face harm from exposure. Victim data is stored in anonymized, aggregate form only.',
                },
                {
                  title: 'No Attribution of Guilt',
                  desc: 'Publication of an incident does not constitute a legal finding or determination of guilt. We document what was reported in credible sources, not what was proven in court.',
                },
                {
                  title: 'Political Neutrality',
                  desc: 'We document violence regardless of which political actor is involved — ruling party, opposition, security forces, or armed groups. Our mandate is documentation, not political commentary.',
                },
                {
                  title: 'Source Transparency',
                  desc: 'Every incident cites its sources. Where information is uncertain, it is clearly marked as unconfirmed. Where reports conflict, we note the discrepancy.',
                },
                {
                  title: 'Correction Policy',
                  desc: 'Errors are corrected as soon as identified, with the original data preserved in the audit log. We do not silently delete or alter published records.',
                },
                {
                  title: 'Data Minimization',
                  desc: 'We collect only what is necessary to document the incident. We do not store personal communications, private contact details, or surveillance data.',
                },
              ].map(item => (
                <div key={item.title}>
                  <div className="text-sm font-semibold text-zinc-800 mb-0.5">{item.title}</div>
                  <div className="text-sm text-zinc-500 leading-relaxed">{item.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Indicators we track */}
          <section>
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-3">Indicators We Track</h2>
            <p className="text-sm text-zinc-500 mb-4">
              In line with international election monitoring standards, we track the following indicators to identify patterns and trends:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                'Number of incidents per election cycle',
                'Geographic distribution — regions, districts, communities',
                'Types of violence by frequency',
                'Impact — fatalities, injuries, arrests',
                'Gender distribution of victims',
                'Age distribution of victims',
                'Target groups — voters, candidates, journalists, officials',
                'Weapons involved',
                'Timing across election stages',
                'Response and accountability actions taken',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-zinc-600 p-2">
                  <span className="text-[#1a1a2e] font-bold shrink-0">→</span>
                  {item}
                </div>
              ))}
            </div>
          </section>

          {/* Data and Wikidata */}
          <section>
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-3">Open Data &amp; Wikidata Integration</h2>
            <div className="text-sm text-zinc-600 leading-relaxed space-y-3">
              <p>
                All published incident data is released under the CC0 1.0 Universal public domain dedication — free to use, share, and build upon without restriction for research, journalism, policy work, or civic technology.
              </p>
              <p>
                Where possible, incidents are linked to Wikidata entities — elections (Q-numbers), locations, political parties, and electoral bodies — making our dataset interoperable with the global open knowledge ecosystem, including Wikimedia projects, academic databases, and international monitoring frameworks.
              </p>
            </div>
          </section>

          {/* Technical */}
          <section>
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-3">Technical Infrastructure</h2>
            <div className="glass-card p-5">
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: 'AI Classification', value: 'Google Gemini 1.5 Flash (two-pass)' },
                  { label: 'Data Sources', value: 'GDELT, RSS feeds, NewsAPI' },
                  { label: 'Database', value: 'PostgreSQL via Supabase' },
                  { label: 'Deduplication', value: 'Upstash Redis + SHA-256 URL hash' },
                  { label: 'Maps', value: 'MapLibre GL + OpenFreeMap tiles' },
                  { label: 'Public API', value: 'REST, rate-limited, CC0' },
                  { label: 'Deployment', value: 'Vercel (serverless, global CDN)' },
                  { label: 'Source Code', value: 'Open source — GitHub' },
                ].map(item => (
                  <div key={item.label} className="flex flex-col gap-0.5">
                    <span className="text-zinc-400">{item.label}</span>
                    <span className="font-medium text-zinc-700">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Developer credit */}
          <section className="border-t border-zinc-100 pt-8">
            <p className="text-xs text-zinc-400 text-center">
              Built by{' '}
              <a href="https://github.com/devjadiya" target="_blank" rel="noopener noreferrer"
                className="text-zinc-600 hover:text-zinc-900 font-medium transition-colors">
                Dev Jadiya
              </a>
              {' '}· Open source ·{' '}
              <a href="https://github.com/devjadiya/election-violence-monitor" target="_blank" rel="noopener noreferrer"
                className="text-zinc-500 hover:text-zinc-700 transition-colors">
                GitHub
              </a>
              {' '}·{' '}
              <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer"
                className="text-zinc-500 hover:text-zinc-700 transition-colors">
                CC0 License
              </a>
            </p>
          </section>
        </div>

        <div className="mt-10 flex gap-3 flex-wrap">
          <Link href="/map" className="bg-[#1a1a2e] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#16213e] transition-colors">
            View Live Map
          </Link>
          <Link href="/reports" className="border border-zinc-200 text-zinc-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors">
            Browse Reports
          </Link>
          <Link href="/developers" className="border border-zinc-200 text-zinc-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors">
            API Documentation
          </Link>
        </div>
      </div>
    </div>
  )
}