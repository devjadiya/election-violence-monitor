'use client'

import { useState } from 'react'
import { Download, FileJson, FileText } from 'lucide-react'

export default function ExportPage() {
  const [loading, setLoading] = useState<string | null>(null)

  async function exportData(format: 'csv' | 'json' | 'wikidata') {
    setLoading(format)
    try {
      const res = await fetch(`/api/export?format=${format}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = format === 'wikidata' ? 'jsonld' : format
      a.download = `evm-incidents-${new Date().toISOString().slice(0, 10)}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Export Data</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Download incident data for research and analysis</p>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="font-semibold text-[#1a1a2e]">Published Incidents</h2>
        <p className="text-sm text-zinc-500">
          Export all verified and published incidents. Sensitive personal details are excluded per our ethical guidelines.
        </p>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <button
            onClick={() => exportData('csv')}
            disabled={!!loading}
            className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-zinc-200 rounded-xl hover:border-[#1a1a2e] hover:bg-zinc-50 transition-all disabled:opacity-50"
          >
            <FileText size={28} className="text-zinc-400" />
            <div className="text-center">
              <div className="font-semibold text-zinc-700">CSV Format</div>
              <div className="text-xs text-zinc-400 mt-0.5">For spreadsheets & GIS tools</div>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-[#1a1a2e] font-medium">
              <Download size={14} />
              {loading === 'csv' ? 'Downloading...' : 'Download CSV'}
            </div>
          </button>

          <button
            onClick={() => exportData('json')}
            disabled={!!loading}
            className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-zinc-200 rounded-xl hover:border-[#1a1a2e] hover:bg-zinc-50 transition-all disabled:opacity-50"
          >
            <FileJson size={28} className="text-zinc-400" />
            <div className="text-center">
              <div className="font-semibold text-zinc-700">JSON Format</div>
              <div className="text-xs text-zinc-400 mt-0.5">For developers & Wikidata</div>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-[#1a1a2e] font-medium">
              <Download size={14} />
              {loading === 'json' ? 'Downloading...' : 'Download JSON'}
            </div>
          </button>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-semibold text-sm text-[#1a1a2e] mb-2">Wikidata-Compatible JSON</h3>
        <p className="text-xs text-zinc-500 mb-3">
          Export structured data linked to Wikidata entities for research and knowledge graph integration.
        </p>
        <button
          onClick={() => exportData('wikidata')}
          disabled={!!loading}
          className="text-sm text-blue-600 hover:underline font-medium disabled:opacity-50"
        >
          {loading === 'wikidata' ? 'Downloading...' : 'Download Wikidata JSON-LD →'}
        </button>
      </div>

      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>Privacy notice:</strong> All exports exclude victim names, personal identifiers, and sensitive demographic data.
          Only aggregate counts and anonymized incident details are included, per our ethical data publication guidelines.
        </p>
      </div>
    </div>
  )
}