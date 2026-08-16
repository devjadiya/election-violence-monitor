'use client'

import ReactECharts from 'echarts-for-react'
import { CATEGORY_COLORS } from '@/constants'

interface Props {
  data: {
    byCategory: { name: string; value: number }[]
    byStage: { name: string; value: number }[]
    byCountry: { name: string; value: number }[]
    byWeapon: { name: string; value: number }[]
    byVictimRole: { name: string; value: number }[]
    byVictimGender: { name: string; value: number }[]
    byVictimAge: { name: string; value: number }[]
    trend: { date: string; count: number }[]
    totals: {
      incidents: number
      fatalities: number
      injured: number
      arrested: number
      published: number
      aiDetected: number
      manualEntry: number
      withResponse: number
    }
  }
}

const chartDefaults = {
  tooltip: { backgroundColor: '#fff', borderColor: '#e4e4e7', textStyle: { color: '#3f3f46', fontSize: 12 } },
}

export function AnalyticsCharts({ data }: Props) {

  // Indicator 1 — Trend
  const trendOption = {
    ...chartDefaults,
    tooltip: { ...chartDefaults.tooltip, trigger: 'axis' },
    grid: { top: 20, right: 20, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: data.trend.map(t => t.date), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#a1a1aa', fontSize: 10 } },
    yAxis: { type: 'value', minInterval: 1, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#f4f4f5' } }, axisLabel: { color: '#a1a1aa', fontSize: 10 } },
    series: [{
      data: data.trend.map(t => t.count),
      type: 'line', smooth: true, symbol: 'none',
      lineStyle: { color: '#1a1a2e', width: 2.5 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(26,26,46,0.15)' }, { offset: 1, color: 'rgba(26,26,46,0)' }] } },
    }],
  }

  // Indicator 3 — Category donut
  const categoryOption = {
    ...chartDefaults,
    tooltip: { ...chartDefaults.tooltip, trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#71717a', fontSize: 10 }, itemWidth: 10, itemHeight: 10 },
    series: [{
      type: 'pie', radius: ['45%', '68%'], center: ['50%', '42%'],
      data: data.byCategory.length > 0 ? data.byCategory : [{ name: 'No data', value: 1 }],
      label: { show: false },
      itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: '#fff' },
      color: Object.values(CATEGORY_COLORS),
    }],
  }

  // Indicator 1 — Geographic distribution
  const countryOption = {
    ...chartDefaults,
    tooltip: { ...chartDefaults.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 10, right: 20, bottom: 20, left: 120 },
    xAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#f4f4f5' } }, axisLabel: { color: '#a1a1aa', fontSize: 10 } },
    yAxis: { type: 'category', data: data.byCountry.map(c => c.name).reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#52525b', fontSize: 10 } },
    series: [{
      type: 'bar', data: data.byCountry.map(c => c.value).reverse(),
      barMaxWidth: 18, itemStyle: { color: '#1a1a2e', borderRadius: [0, 4, 4, 0] },
    }],
  }

  // Indicator 9 — Timing (stage)
  const stageOption = {
    ...chartDefaults,
    tooltip: { ...chartDefaults.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 10, right: 20, bottom: 40, left: 40 },
    xAxis: { type: 'category', data: data.byStage.map(s => s.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#71717a', fontSize: 10, rotate: 15 } },
    yAxis: { type: 'value', minInterval: 1, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#f4f4f5' } }, axisLabel: { color: '#a1a1aa', fontSize: 10 } },
    series: [{
      type: 'bar', data: data.byStage.map(s => s.value),
      barMaxWidth: 40, itemStyle: { color: '#7c3aed', borderRadius: [4, 4, 0, 0] },
    }],
  }

  // Indicator 8 — Weapons
  const weaponOption = {
    ...chartDefaults,
    tooltip: { ...chartDefaults.tooltip, trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#71717a', fontSize: 10 }, itemWidth: 10, itemHeight: 10 },
    series: [{
      type: 'pie', radius: ['35%', '60%'], center: ['50%', '42%'],
      data: data.byWeapon.length > 0 ? data.byWeapon : [{ name: 'No data', value: 1 }],
      label: { show: false },
      itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: '#fff' },
      color: ['#dc2626', '#d97706', '#2563eb', '#7c3aed', '#059669', '#6b7280'],
    }],
  }

  // Indicator 5 — Gender distribution
  const genderOption = {
    ...chartDefaults,
    tooltip: { ...chartDefaults.tooltip, trigger: 'item' },
    series: [{
      type: 'pie', radius: ['45%', '68%'], center: ['50%', '50%'],
      data: data.byVictimGender.length > 0 ? data.byVictimGender : [{ name: 'No data', value: 1 }],
      label: { formatter: '{b}\n{d}%', fontSize: 11, color: '#52525b' },
      labelLine: { smooth: true },
      itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: '#fff' },
      color: ['#3b82f6', '#ec4899', '#8b5cf6'],
    }],
  }

  // Indicator 6 — Age distribution
  const ageOption = {
    ...chartDefaults,
    tooltip: { ...chartDefaults.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 10, right: 20, bottom: 30, left: 90 },
    xAxis: { type: 'value', minInterval: 1, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#f4f4f5' } }, axisLabel: { color: '#a1a1aa', fontSize: 10 } },
    yAxis: { type: 'category', data: data.byVictimAge.map(a => a.name).reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#52525b', fontSize: 10 } },
    series: [{
      type: 'bar', data: data.byVictimAge.map(a => a.value).reverse(),
      barMaxWidth: 18, itemStyle: { color: '#0891b2', borderRadius: [0, 4, 4, 0] },
    }],
  }

  // Indicator 7 — Target groups (victim roles)
  const roleOption = {
    ...chartDefaults,
    tooltip: { ...chartDefaults.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 10, right: 20, bottom: 20, left: 140 },
    xAxis: { type: 'value', minInterval: 1, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#f4f4f5' } }, axisLabel: { color: '#a1a1aa', fontSize: 10 } },
    yAxis: { type: 'category', data: data.byVictimRole.map(r => r.name).reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#52525b', fontSize: 10 } },
    series: [{
      type: 'bar', data: data.byVictimRole.map(r => r.value).reverse(),
      barMaxWidth: 18, itemStyle: { color: '#059669', borderRadius: [0, 4, 4, 0] },
    }],
  }

  const statCard = (value: string | number, label: string, sub?: string, color = 'text-[#1a1a2e]') => (
    <div className="glass-card p-4 text-center">
      <div className={`text-2xl font-bold ${color} mb-0.5`}>{value}</div>
      <div className="text-xs font-medium text-zinc-600">{label}</div>
      {sub && <div className="text-[10px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  )

  const chartCard = (title: string, subtitle: string, chart: any, height = 220) => (
    <div className="glass-card p-5">
      <div className="mb-3">
        <div className="text-sm font-semibold text-[#1a1a2e]">{title}</div>
        <div className="text-xs text-zinc-400 mt-0.5">{subtitle}</div>
      </div>
      <ReactECharts option={chart} style={{ height }} opts={{ renderer: 'svg' }} />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Indicator 4 — Impact totals */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Indicator 4 — Impact on Individuals
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {statCard(data.totals.incidents, 'Total Incidents', 'All statuses')}
          {statCard(data.totals.published, 'Published', 'Publicly visible', 'text-green-600')}
          {statCard(data.totals.fatalities, 'Fatalities', 'Reported deaths', 'text-red-600')}
          {statCard(data.totals.injured, 'Injured', 'Reported injuries', 'text-orange-500')}
          {statCard(data.totals.arrested, 'Arrested', 'Reported arrests', 'text-blue-600')}
          {statCard(data.totals.aiDetected, 'Machine-extracted', 'Awaiting or past review', 'text-violet-600')}
          {statCard(data.totals.withResponse, 'With Response', 'Accountability actions', 'text-teal-600')}
        </div>
      </div>

      {/* Indicator 1 — Trend */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Indicator 1 — Incidents Over Time (last 60 days)
        </h2>
        {chartCard('Incident Trend', 'Number of incidents by occurrence date', trendOption, 200)}
      </div>

      {/* Indicators 3 + 1 geographic */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Indicator 2 + 3 — Geographic Distribution &amp; Violence Types
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {chartCard('By Country', 'Top 12 countries by incident count', countryOption, 280)}
          {chartCard('By Category', 'Types of election violence documented', categoryOption, 280)}
        </div>
      </div>

      {/* Indicators 9 + 8 */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Indicator 9 — Timing Across Election Stages &nbsp;·&nbsp; Indicator 8 — Weapons
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {chartCard('By Election Stage', 'When in the electoral cycle violence occurs', stageOption, 220)}
          {chartCard('By Weapon Type', 'Types of weapons involved in incidents', weaponOption, 220)}
        </div>
      </div>

      {/* Indicators 5 + 6 + 7 */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Indicators 5, 6, 7 — Victim Demographics &amp; Target Groups
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {chartCard('Gender Distribution', 'Indicator 5 — Gender of affected individuals', genderOption, 220)}
          {chartCard('Age Distribution', 'Indicator 6 — Age groups affected', ageOption, 220)}
          {chartCard('Target Groups', 'Indicator 7 — Role of victims in electoral process', roleOption, 220)}
        </div>
      </div>

      {/* Indicator 10 — Accountability */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Indicator 10 — Response &amp; Accountability
        </h2>
        <div className="glass-card p-5">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-teal-600">{data.totals.withResponse}</div>
              <div className="text-xs text-zinc-500 mt-0.5">Incidents with confirmed responses</div>
            </div>
            <div className="w-px h-12 bg-zinc-100" />
            <div className="text-center">
              <div className="text-3xl font-bold text-zinc-700">
                {data.totals.incidents > 0 ? Math.round((data.totals.withResponse / data.totals.incidents) * 100) : 0}%
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">Response rate</div>
            </div>
            <div className="flex-1 text-sm text-zinc-500 leading-relaxed ml-4">
              Follow-up actions include investigations launched, arrests made, legal proceedings initiated, and official responses from electoral authorities. These are recorded separately from the incident itself.
            </div>
          </div>
        </div>
      </div>

      {/* Data quality */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-[#1a1a2e] mb-3">Data Quality Statement</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="font-medium text-zinc-700">AI-assisted</div>
            <div className="text-zinc-400">{data.totals.aiDetected} incidents detected by AI pipeline</div>
          </div>
          <div>
            <div className="font-medium text-zinc-700">Manual entry</div>
            <div className="text-zinc-400">{data.totals.manualEntry} incidents entered by analysts</div>
          </div>
          <div>
            <div className="font-medium text-zinc-700">Human reviewed</div>
            <div className="text-zinc-400">All published incidents verified by human reviewers</div>
          </div>
          <div>
            <div className="font-medium text-zinc-700">Do-no-harm</div>
            <div className="text-zinc-400">All victim data anonymized. No personal identifiers published.</div>
          </div>
        </div>
      </div>
    </div>
  )
}