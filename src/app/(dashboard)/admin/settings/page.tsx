'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Key, Bell, Shield, Globe, Database } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (profile.newPassword !== profile.confirmPassword) {
      alert('Passwords do not match')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: profile.currentPassword,
          newPassword: profile.newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSaved(true)
      setProfile(p => ({ ...p, currentPassword: '', newPassword: '', confirmPassword: '' }))
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile & Password', icon: Key },
    { id: 'system', label: 'System', icon: Database },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'api', label: 'API Access', icon: Globe },
  ]

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/10 focus:border-[#1a1a2e] transition-all"
  const labelClass = "block text-sm font-medium text-zinc-700 mb-1.5"

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage your account and system preferences</p>
      </div>

      {saved && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
          ✅ Settings saved successfully
        </div>
      )}

      <div className="flex gap-5">
        {/* Sidebar */}
        <div className="w-48 shrink-0">
          <nav className="space-y-0.5">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                  activeTab === id
                    ? 'bg-[#1a1a2e] text-white font-medium'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <form onSubmit={savePassword} className="glass-card p-6 space-y-4">
              <h2 className="font-semibold text-[#1a1a2e]">Change Password</h2>
              <div>
                <label className={labelClass}>Current Password</label>
                <input type="password" className={inputClass} value={profile.currentPassword}
                  onChange={e => setProfile(p => ({ ...p, currentPassword: e.target.value }))} required />
              </div>
              <div>
                <label className={labelClass}>New Password</label>
                <input type="password" className={inputClass} value={profile.newPassword}
                  onChange={e => setProfile(p => ({ ...p, newPassword: e.target.value }))} required minLength={8} />
                <p className="text-xs text-zinc-400 mt-1">Minimum 8 characters</p>
              </div>
              <div>
                <label className={labelClass}>Confirm New Password</label>
                <input type="password" className={inputClass} value={profile.confirmPassword}
                  onChange={e => setProfile(p => ({ ...p, confirmPassword: e.target.value }))} required />
              </div>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 bg-[#1a1a2e] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#16213e] transition-colors disabled:opacity-50">
                <Save size={14} />
                {saving ? 'Saving...' : 'Update Password'}
              </button>
            </form>
          )}

          {activeTab === 'system' && (
            <div className="glass-card p-6 space-y-5">
              <h2 className="font-semibold text-[#1a1a2e]">System Configuration</h2>
              <div className="space-y-3">
                {[
                  { label: 'AI Model', value: 'Gemini 1.5 Flash', badge: 'Active' },
                  { label: 'Ingestion Schedule', value: 'Daily at 9:00 UTC', badge: 'Running' },
                  { label: 'Database', value: 'Supabase PostgreSQL', badge: 'Connected' },
                  { label: 'Cache', value: 'Upstash Redis', badge: 'Connected' },
                  { label: 'Queue', value: 'Upstash QStash', badge: 'Active' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-zinc-700">{item.label}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">{item.value}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">{item.badge}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="glass-card p-6 space-y-4">
              <h2 className="font-semibold text-[#1a1a2e]">Notification Preferences</h2>
              {[
                { label: 'New incident detected by AI', desc: 'Get notified when AI flags a new incident' },
                { label: 'Incident needs review', desc: 'Alert when an incident enters review queue' },
                { label: 'Incident published', desc: 'Confirmation when an incident goes live' },
                { label: 'Ingestion completed', desc: 'Daily report of ingestion results' },
                { label: 'System errors', desc: 'Critical system and database errors' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-zinc-700">{item.label}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{item.desc}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1a1a2e]" />
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="glass-card p-6 space-y-4">
              <h2 className="font-semibold text-[#1a1a2e]">Security Settings</h2>
              <div className="space-y-3">
                {[
                  { label: 'Password Hashing', value: 'bcrypt (cost factor 12)', status: 'Secure' },
                  { label: 'Session Strategy', value: 'JWT tokens', status: 'Active' },
                  { label: 'Public Data', value: 'Anonymized victim data', status: 'Enforced' },
                  { label: 'API Authentication', value: 'Bearer token required', status: 'Active' },
                  { label: 'RBAC', value: '6-level role hierarchy', status: 'Active' },
                  { label: 'Audit Logging', value: 'All incident changes logged', status: 'Active' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-zinc-700">{item.label}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">{item.value}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="glass-card p-6 space-y-4">
              <h2 className="font-semibold text-[#1a1a2e]">Public API Access</h2>
              <p className="text-sm text-zinc-500">External researchers can access published incidents via the public API.</p>
              <div className="space-y-3">
                {[
                  { method: 'GET', endpoint: '/api/public/manage/incidents', desc: 'List published incidents' },
                  { method: 'GET', endpoint: '/api/public/manage/incidents/:id', desc: 'Get single incident' },
                  { method: 'GET', endpoint: '/api/public/stats', desc: 'Aggregate statistics' },
                  { method: 'GET', endpoint: '/api/export?format=csv', desc: 'Export as CSV' },
                  { method: 'GET', endpoint: '/api/export?format=json', desc: 'Export as JSON' },
                ].map(item => (
                  <div key={item.endpoint} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg font-mono text-xs">
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold shrink-0">{item.method}</span>
                    <div>
                      <div className="text-zinc-800">{item.endpoint}</div>
                      <div className="text-zinc-400 font-sans mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}