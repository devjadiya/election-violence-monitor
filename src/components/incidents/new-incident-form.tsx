'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORY_LABELS, STAGE_LABELS, WEAPON_LABELS } from '@/constants'
import { toast } from 'sonner'

interface Election {
  id: string
  name: string
  country: string
  electionType: string
}

interface Props {
  elections: Election[]
}

export function NewIncidentForm({ elections }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'PHYSICAL_ASSAULT',
    electionStage: 'UNKNOWN',
    electionId: '',
    country: '',
    region: '',
    district: '',
    community: '',
    specificLocation: '',
    latitude: '',
    longitude: '',
    occurredAt: '',
    injured: '0',
    fatalities: '0',
    arrested: '0',
    propertyDamage: false,
    votingDisrupted: false,
    weaponType: 'UNKNOWN',
    victimRole: 'UNKNOWN',
    victimGender: 'UNKNOWN',
    victimAgeGroup: 'UNKNOWN',
    victimCount: '1',
    actorType: '',
    partyName: '',
    sourceUrl: '',
    sourceName: '',
  })

  function update(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }))
  }

  // Auto-fill country when election selected
  function selectElection(id: string) {
    update('electionId', id)
    if (id) {
      const election = elections.find(e => e.id === id)
      if (election && !form.country) update('country', election.country)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
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
          victim: { role: form.victimRole, gender: form.victimGender, ageGroup: form.victimAgeGroup, count: Number(form.victimCount) },
          actor: form.actorType ? { actorType: form.actorType, partyName: form.partyName || null } : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create incident')
      toast.success('Incident created successfully', { description: 'Pending review by your team.' })
      router.push(`/incidents/${data.id}`)
    } catch (err: any) {
      setError(err.message)
      toast.error('Failed to create incident', { description: err.message })
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/10 focus:border-[#1a1a2e] transition-all bg-white"
  const labelClass = "block text-sm font-medium text-zinc-700 mb-1.5"

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">New Incident</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manually document an election violence incident</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-[#1a1a2e] text-sm">Basic Information</h2>

          {elections.length > 0 && (
            <div>
              <label className={labelClass}>Linked Election</label>
              <select className={inputClass} value={form.electionId} onChange={e => selectElection(e.target.value)}>
                <option value="">— Select election (optional) —</option>
                {elections.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.country})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>Title *</label>
            <input className={inputClass} value={form.title} onChange={e => update('title', e.target.value)} required placeholder="Brief title of the incident" />
          </div>

          <div>
            <label className={labelClass}>Description *</label>
            <textarea className={`${inputClass} min-h-24 resize-y`} value={form.description} onChange={e => update('description', e.target.value)} required placeholder="Detailed description of what happened..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category *</label>
              <select className={inputClass} value={form.category} onChange={e => update('category', e.target.value)}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Election Stage *</label>
              <select className={inputClass} value={form.electionStage} onChange={e => update('electionStage', e.target.value)}>
                {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Date & Time of Incident *</label>
            <input type="datetime-local" className={inputClass} value={form.occurredAt} onChange={e => update('occurredAt', e.target.value)} required />
          </div>
        </div>

        {/* Location */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-[#1a1a2e] text-sm">Location</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Country *</label>
              <input className={inputClass} value={form.country} onChange={e => update('country', e.target.value)} required placeholder="e.g. Nigeria" />
            </div>
            <div>
              <label className={labelClass}>State / Region</label>
              <input className={inputClass} value={form.region} onChange={e => update('region', e.target.value)} placeholder="e.g. Lagos" />
            </div>
            <div>
              <label className={labelClass}>District / LGA</label>
              <input className={inputClass} value={form.district} onChange={e => update('district', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Community / Town</label>
              <input className={inputClass} value={form.community} onChange={e => update('community', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Latitude</label>
              <input type="number" step="any" className={inputClass} value={form.latitude} onChange={e => update('latitude', e.target.value)} placeholder="e.g. 6.5244" />
            </div>
            <div>
              <label className={labelClass}>Longitude</label>
              <input type="number" step="any" className={inputClass} value={form.longitude} onChange={e => update('longitude', e.target.value)} placeholder="e.g. 3.3792" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Specific Location</label>
            <input className={inputClass} value={form.specificLocation} onChange={e => update('specificLocation', e.target.value)} placeholder="e.g. Polling Unit 003, Ward 5" />
          </div>
        </div>

        {/* Impact */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-[#1a1a2e] text-sm">Impact</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Fatalities</label>
              <input type="number" min="0" className={inputClass} value={form.fatalities} onChange={e => update('fatalities', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Injured</label>
              <input type="number" min="0" className={inputClass} value={form.injured} onChange={e => update('injured', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Arrested</label>
              <input type="number" min="0" className={inputClass} value={form.arrested} onChange={e => update('arrested', e.target.value)} />
            </div>
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

        {/* Victim Info */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-[#1a1a2e] text-sm">Victim Information</h2>
          <p className="text-xs text-zinc-400">Aggregate demographics only — no names or identifiers</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Victim Role</label>
              <select className={inputClass} value={form.victimRole} onChange={e => update('victimRole', e.target.value)}>
                {['UNKNOWN', 'VOTER', 'CANDIDATE', 'CAMPAIGN_STAFF', 'ELECTION_OFFICIAL', 'ELECTION_OBSERVER', 'JOURNALIST', 'PARTY_SUPPORTER', 'SECURITY_PERSONNEL', 'COMMUNITY_MEMBER'].map(r => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Number of Victims</label>
              <input type="number" min="1" className={inputClass} value={form.victimCount} onChange={e => update('victimCount', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Gender</label>
              <select className={inputClass} value={form.victimGender} onChange={e => update('victimGender', e.target.value)}>
                {['UNKNOWN', 'MALE', 'FEMALE', 'NON_BINARY'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Age Group</label>
              <select className={inputClass} value={form.victimAgeGroup} onChange={e => update('victimAgeGroup', e.target.value)}>
                {['UNKNOWN', 'UNDER_18', 'AGE_18_25', 'AGE_26_40', 'AGE_41_60', 'ABOVE_60'].map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Perpetrator Type</label>
              <input className={inputClass} value={form.actorType} onChange={e => update('actorType', e.target.value)} placeholder="e.g. political_party, militia" />
            </div>
            <div>
              <label className={labelClass}>Party Name (if applicable)</label>
              <input className={inputClass} value={form.partyName} onChange={e => update('partyName', e.target.value)} placeholder="e.g. APC, PDP" />
            </div>
          </div>
        </div>

        {/* Source */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-[#1a1a2e] text-sm">Source</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Source Name</label>
              <input className={inputClass} value={form.sourceName} onChange={e => update('sourceName', e.target.value)} placeholder="e.g. Channels TV" />
            </div>
            <div>
              <label className={labelClass}>Source URL</label>
              <input type="url" className={inputClass} value={form.sourceUrl} onChange={e => update('sourceUrl', e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pb-6">
          <button type="submit" disabled={loading}
            className="bg-[#1a1a2e] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#16213e] transition-colors disabled:opacity-50">
            {loading ? 'Saving...' : 'Create Incident'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-6 py-2.5 rounded-lg text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}