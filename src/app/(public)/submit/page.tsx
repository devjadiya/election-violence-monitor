'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CATEGORY_LABELS } from '@/constants'

export default function SubmitTipPage() {
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    description: '',
    location: '',
    occurredAt: '',
    category: '',
    isAnonymous: true,
    contactEmail: '',
  })

  function update(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : null,
        }),
      })
      if (res.ok) setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/10 focus:border-[#1a1a2e] transition-all bg-white"
  const labelClass = "block text-sm font-medium text-zinc-700 mb-1.5"

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✅</span>
          </div>
          <h2 className="text-xl font-bold text-[#1a1a2e] mb-2">Tip Submitted</h2>
          <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
            Thank you for your report. Our team will review it and verify from credible sources before any publication. Your identity is protected.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/" className="bg-[#1a1a2e] text-white px-5 py-2.5 rounded-lg text-sm font-medium">
              Return Home
            </Link>
            <button onClick={() => { setSubmitted(false); setForm({ description: '', location: '', occurredAt: '', category: '', isAnonymous: true, contactEmail: '' }); setStep(1) }}
              className="border border-zinc-200 text-zinc-600 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-50">
              Submit Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="glass-nav fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1a1a2e] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">EV</span>
            </div>
            <span className="font-semibold text-[#1a1a2e] text-sm">Election Violence Monitor</span>
          </Link>
          <Link href="/login" className="text-sm bg-[#1a1a2e] text-white px-3 py-1.5 rounded-lg font-medium">Sign In</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 pt-28 pb-16">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4 border border-orange-100">
            🔒 Anonymous & Secure
          </div>
          <h1 className="text-3xl font-bold text-[#1a1a2e] mb-3">Submit an Incident Report</h1>
          <p className="text-zinc-500 leading-relaxed">
            Have information about election-related violence? Submit a confidential tip. All reports are reviewed by our team before publication. Your identity is never disclosed.
          </p>
        </div>

        {/* Ethics notice */}
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mb-6">
          <p className="text-xs text-blue-700 leading-relaxed">
            <strong>Do no harm:</strong> Do not include names, photos, or identifying details of victims or witnesses. Only submit information you believe to be true. All tips are verified against credible sources before any publication.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="glass-card p-6 space-y-4">
            <div>
              <label className={labelClass}>What happened? *</label>
              <textarea
                className={`${inputClass} min-h-32 resize-y`}
                value={form.description}
                onChange={e => update('description', e.target.value)}
                required
                placeholder="Describe the incident in detail. What happened, when, and who was affected? Do not include personal names."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Location</label>
                <input className={inputClass} value={form.location}
                  onChange={e => update('location', e.target.value)}
                  placeholder="e.g. Lagos, Eti-Osa LGA" />
              </div>
              <div>
                <label className={labelClass}>When did it happen?</label>
                <input type="datetime-local" className={inputClass} value={form.occurredAt}
                  onChange={e => update('occurredAt', e.target.value)} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Type of Incident</label>
              <select className={inputClass} value={form.category} onChange={e => update('category', e.target.value)}>
                <option value="">Select category (optional)</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="glass-card p-6 space-y-4">
            <h2 className="font-semibold text-[#1a1a2e] text-sm">Your Privacy</h2>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.isAnonymous}
                onChange={e => update('isAnonymous', e.target.checked)}
                className="mt-0.5 rounded" />
              <div>
                <div className="text-sm font-medium text-zinc-700">Submit anonymously</div>
                <div className="text-xs text-zinc-400 mt-0.5">We will not store any identifying information about you</div>
              </div>
            </label>

            {!form.isAnonymous && (
              <div>
                <label className={labelClass}>Contact Email (optional)</label>
                <input type="email" className={inputClass} value={form.contactEmail}
                  onChange={e => update('contactEmail', e.target.value)}
                  placeholder="For follow-up questions only" />
                <p className="text-xs text-zinc-400 mt-1">Only used if we need to verify details. Never shared publicly.</p>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading || !form.description}
            className="w-full bg-[#1a1a2e] text-white py-3 rounded-xl text-sm font-medium hover:bg-[#16213e] transition-colors disabled:opacity-50">
            {loading ? 'Submitting...' : 'Submit Report Confidentially'}
          </button>

          <p className="text-center text-xs text-zinc-400">
            By submitting, you confirm this information is truthful to the best of your knowledge.
          </p>
        </form>
      </div>
    </div>
  )
}