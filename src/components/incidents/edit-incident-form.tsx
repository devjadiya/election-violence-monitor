'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORY_LABELS, STAGE_LABELS, WEAPON_LABELS } from '@/constants'

interface Props {
  incident: any
  elections: { id: string; name: string; country: string }[]
}

export function EditIncidentForm({ incident, elections }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: incident.title,
    description: incident.description,
    category: incident.category,
    electionStage: incident.electionStage,
    electionId: incident.electionId ?? '',
    country: incident.country,
    region: incident.region ?? '',
    district: incident.district ?? '',
    community: incident.community ?? '',
    specificLocation: incident.specificLocation ?? '',
    latitude: incident.latitude?.toString() ?? '',
    longitude: incident.longitude?.toString() ?? '',
    occurredAt: new Date(incident.occurredAt).toISOString().slice(0, 16),
    injured: incident.injured.toString(),
    fatalities: incident.fatalities.toString(),
    arrested: incident.arrested.toString(),
    propertyDamage: incident.propertyDamage,
    votingDisrupted: incident.votingDisrupted,
    weaponType: incident.weaponType,
  })

  function update(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/incidents/${incident.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          injured: Number(form.injured),
          fatalities: Number(form.fatalities),
          arrested: Number(form.arrested),
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
          occurredAt: new Date(form.occurredAt).toISOString(),
          electionId: form.electionId || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to update')
      router.push(`/incidents/${incident.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/10 focus:border-[#1a1a2e] transition-all bg-white"
  const labelClass = "block text-sm font-medium text-zinc-700 mb-1.5"

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-zinc-400">{incident.referenceId}</span>
        </div>
        <h1 className="text-2xl font-bold text-[#1a1a2e]">Edit Incident</h1>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-[#1a1a2e] text-sm">Basic Information</h2>

          {elections.length > 0 && (
            <div>
              <label className={labelClass}>Linked Election</label>
              <select className={inputClass} value={form.electionId} onChange={e => update('electionId', e.target.value)}>
                <option value="">— None —</option>
                {elections.map(e => <option key={e.id} value={e.id}>{e.name} ({e.country})</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>Title *</label>
            <input className={inputClass} value={form.title} onChange={e => update('title', e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Description *</label>
            <textarea className={`${inputClass} min-h-28 resize-y`} value={form.description} onChange={e => update('description', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category</label>
              <select className={inputClass} value={form.category} onChange={e => update('category', e.target.value)}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Election Stage</label>
              <select className={inputClass} value={form.electionStage} onChange={e => update('electionStage', e.target.value)}>
                {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Date & Time</label>
            <input type="datetime-local" className={inputClass} value={form.occurredAt} onChange={e => update('occurredAt', e.target.value)} />
          </div>
        </div>

        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-[#1a1a2e] text-sm">Location</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Country *</label><input className={inputClass} value={form.country} onChange={e => update('country', e.target.value)} required /></div>
            <div><label className={labelClass}>Region</label><input className={inputClass} value={form.region} onChange={e => update('region', e.target.value)} /></div>
            <div><label className={labelClass}>District</label><input className={inputClass} value={form.district} onChange={e => update('district', e.target.value)} /></div>
            <div><label className={labelClass}>Community</label><input className={inputClass} value={form.community} onChange={e => update('community', e.target.value)} /></div>
            <div><label className={labelClass}>Latitude</label><input type="number" step="any" className={inputClass} value={form.latitude} onChange={e => update('latitude', e.target.value)} /></div>
            <div><label className={labelClass}>Longitude</label><input type="number" step="any" className={inputClass} value={form.longitude} onChange={e => update('longitude', e.target.value)} /></div>
          </div>
        </div>

        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-[#1a1a2e] text-sm">Impact</h2>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={labelClass}>Fatalities</label><input type="number" min="0" className={inputClass} value={form.fatalities} onChange={e => update('fatalities', e.target.value)} /></div>
            <div><label className={labelClass}>Injured</label><input type="number" min="0" className={inputClass} value={form.injured} onChange={e => update('injured', e.target.value)} /></div>
            <div><label className={labelClass}>Arrested</label><input type="number" min="0" className={inputClass} value={form.arrested} onChange={e => update('arrested', e.target.value)} /></div>
          </div>
          <div>
            <label className={labelClass}>Weapon Type</label>
            <select className={inputClass} value={form.weaponType} onChange={e => update('weaponType', e.target.value)}>
              {Object.entries(WEAPON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
              <input type="checkbox" checked={form.propertyDamage} onChange={e => update('propertyDamage', e.target.checked)} className="rounded" />
              Property Damage
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
              <input type="checkbox" checked={form.votingDisrupted} onChange={e => update('votingDisrupted', e.target.checked)} className="rounded" />
              Voting Disrupted
            </label>
          </div>
        </div>

        <div className="flex gap-3 pb-6">
          <button type="submit" disabled={loading}
            className="bg-[#1a1a2e] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#16213e] transition-colors disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-6 py-2.5 rounded-lg text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}