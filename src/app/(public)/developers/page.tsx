import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'API Documentation',
  description: 'Public REST API for election violence incident data. CC0 licensed, rate limited.',
}

const BASE = 'https://election-violence-monitor.vercel.app'

export default function DevelopersPage() {
  const endpoint = (method: string, path: string, desc: string, params?: { name: string; desc: string }[]) => (
    <div className="glass-card p-5 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded font-mono">{method}</span>
        <code className="text-sm font-mono text-zinc-800">{BASE}{path}</code>
      </div>
      <p className="text-sm text-zinc-500 mb-3">{desc}</p>
      {params && params.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Parameters</div>
          {params.map(p => (
            <div key={p.name} className="flex gap-3 text-xs">
              <code className="text-blue-600 font-mono shrink-0">{p.name}</code>
              <span className="text-zinc-500">{p.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

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
            <Link href="/about" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">About</Link>
            <Link href="/login" className="text-sm bg-[#1a1a2e] text-white px-3 py-1.5 rounded-lg font-medium">Sign In</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1a1a2e] mb-2">Public API Documentation</h1>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-2xl">
            Access verified election violence incident data programmatically. All data is CC0 licensed — free for research, journalism, and civic technology. No authentication required for read access.
          </p>
        </div>

        {/* Key facts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Auth Required', value: 'No' },
            { label: 'Rate Limit', value: '100 req/hour' },
            { label: 'License', value: 'CC0 1.0' },
            { label: 'Format', value: 'JSON' },
          ].map(f => (
            <div key={f.label} className="glass-card p-4 text-center">
              <div className="text-sm font-bold text-[#1a1a2e]">{f.value}</div>
              <div className="text-xs text-zinc-400 mt-0.5">{f.label}</div>
            </div>
          ))}
        </div>

        {/* Base URL */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-[#1a1a2e] mb-3">Base URL</h2>
          <code className="block bg-zinc-900 text-green-400 px-4 py-3 rounded-lg text-sm font-mono">
            {BASE}
          </code>
        </div>

        {/* Endpoints */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-[#1a1a2e] mb-4">Endpoints</h2>

          {endpoint('GET', '/api/public/incidents', 'List all published incidents. Supports filtering and pagination.', [
            { name: 'country', desc: 'Filter by country name (partial match, case-insensitive). E.g. ?country=Nigeria' },
            { name: 'category', desc: 'Filter by incident type. E.g. ?category=ARMED_ATTACK' },
            { name: 'from', desc: 'Filter incidents from this date. ISO format. E.g. ?from=2025-01-01' },
            { name: 'to', desc: 'Filter incidents up to this date. ISO format. E.g. ?to=2025-12-31' },
            { name: 'page', desc: 'Page number for pagination. Default: 1' },
            { name: 'pageSize', desc: 'Results per page. Max: 100. Default: 20' },
          ])}

          {endpoint('GET', '/api/public/stats', 'Aggregate statistics — total incidents, fatalities, injured, by category and country.')}

          {endpoint('GET', '/api/export?format=csv', 'Download all published incidents as CSV for spreadsheet analysis.')}
          {endpoint('GET', '/api/export?format=json', 'Download all published incidents as JSON.')}
          {endpoint('GET', '/api/export?format=wikidata', 'Download incidents as JSON-LD compatible with Wikidata schema.org markup.')}
        </div>

        {/* Incident categories */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-[#1a1a2e] mb-3">Incident Categories</h2>
          <div className="glass-card p-4">
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {[
                'PHYSICAL_ASSAULT', 'ARMED_ATTACK', 'VOTER_INTIMIDATION',
                'POLITICAL_PARTY_CLASH', 'POLLING_UNIT_DISRUPTION', 'INFRASTRUCTURE_ATTACK',
                'PROPERTY_DAMAGE', 'SECURITY_FORCE_MISCONDUCT', 'KIDNAPPING', 'POST_ELECTION_VIOLENCE',
              ].map(c => (
                <div key={c} className="text-blue-600 bg-blue-50 px-2 py-1 rounded">{c}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Example response */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-[#1a1a2e] mb-3">Example Response</h2>
          <pre className="bg-zinc-900 text-zinc-300 p-5 rounded-xl text-xs overflow-x-auto leading-relaxed">
{`{
  "success": true,
  "data": [
    {
      "referenceId": "EVM-2025-00001",
      "title": "Ballot boxes snatched at gunpoint in Imo State",
      "description": "Armed men stormed Umuguma Ward polling unit...",
      "category": "POLLING_UNIT_DISRUPTION",
      "electionStage": "ELECTION_DAY",
      "country": "Nigeria",
      "region": "Imo State",
      "district": "Owerri West LGA",
      "community": "Umuguma Ward",
      "latitude": 5.4836,
      "longitude": 7.0498,
      "occurredAt": "2025-11-08T10:30:00.000Z",
      "fatalities": 0,
      "injured": 2,
      "arrested": 3,
      "weaponType": "FIREARMS",
      "confidenceScore": 92,
      "publishedAt": "2025-11-09T07:00:00.000Z",
      "wikidataId": null
    }
  ],
  "meta": {
    "total": 47,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  },
  "license": "CC0 1.0 Universal",
  "attribution": "Election Violence Monitor — election-violence-monitor.vercel.app"
}`}
          </pre>
        </div>

        {/* Rate limiting */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-[#1a1a2e] mb-3">Rate Limiting</h2>
          <div className="glass-card p-5 text-sm text-zinc-600 space-y-2">
            <p>Rate limits are applied per IP address using a sliding window algorithm.</p>
            <div className="grid grid-cols-2 gap-3 text-xs mt-3">
              {[
                { endpoint: '/api/public/incidents', limit: '100 requests / hour' },
                { endpoint: '/api/public/stats', limit: '100 requests / hour' },
                { endpoint: '/api/export', limit: '20 requests / hour' },
                { endpoint: '/submit (tips)', limit: '5 requests / hour' },
              ].map(r => (
                <div key={r.endpoint} className="flex justify-between p-2 bg-zinc-50 rounded-lg">
                  <code className="text-zinc-600">{r.endpoint}</code>
                  <span className="text-zinc-400">{r.limit}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-400 mt-2">
              When rate limited, the API returns HTTP 429 with a Retry-After header.
              For bulk access or research partnerships, contact us via GitHub.
            </p>
          </div>
        </div>

        {/* License */}
        <div className="p-5 bg-blue-50 rounded-xl border border-blue-100">
          <h2 className="text-sm font-bold text-blue-800 mb-2">License &amp; Attribution</h2>
          <p className="text-sm text-blue-700 leading-relaxed">
            All data is released under{' '}
            <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer"
              className="underline font-medium">CC0 1.0 Universal</a>{' '}
            — you may use, share, and build upon it without restriction.
            While not required, attribution to the Election Violence Monitor is appreciated in published work.
            Victim data is anonymized and does not include personally identifying information.
          </p>
        </div>
      </div>
    </div>
  )
}