'use client'

import ReactECharts from 'echarts-for-react'
import { CATEGORY_COLORS } from '@/constants'

interface Props {
  data: {
    byCategory: { name: string; value: number }[]
    byStage: { name: string; value: number }[]
    byCountry: { name: string; value: number }[]
    trend: { date: string; count: number }[]
    totals: { incidents: number; fatalities: number; injured: number; arrested: number }
  }
}

export function AnalyticsCharts({ data }: Props) {
  const trendOption = {
    tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e4e4e7', textStyle: { color: '#3f3f46', fontSize: 12 } },
    grid: { top: 20, right: 20, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: data.trend.map(t => t.date), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#a1a1aa', fontSize: 11 } },
    yAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#f4f4f5' } }, axisLabel: { color: '#a1a1aa', fontSize: 11 } },
    series: [{
      data: data.trend.map(t => t.count),
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#1a1a2e', width: 2 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(26,26,46,0.12)' }, { offset: 1, color: 'rgba(26,26,46,0)' }] } },
    }],
  }

  const categoryOption = {
    tooltip: { trigger: 'item', backgroundColor: '#fff', borderColor: '#e4e4e7', textStyle: { color: '#3f3f46', fontSize: 12 } },
    legend: { bottom: 0, textStyle: { color: '#71717a', fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '45%'],
      data: data.byCategory.length > 0 ? data.byCategory : [{ name: 'No data', value: 1 }],
      label: { show: false },
      itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: '#fff' },
    }],
  }

  const countryOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#fff', borderColor: '#e4e4e7', textStyle: { color: '#3f3f46', fontSize: 12 } },
    grid: { top: 10, right: 20, bottom: 30, left: 100 },
    xAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#f4f4f5' } }, axisLabel: { color: '#a1a1aa', fontSize: 11 } },
    yAxis: { type: 'category', data: data.byCountry.map(c => c.name).reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#52525b', fontSize: 11 } },
    series: [{
      type: 'bar',
      data: data.byCountry.map(c => c.value).reverse(),
      barMaxWidth: 20,
      itemStyle: { color: '#1a1a2e', borderRadius: [0, 4, 4, 0] },
    }],
  }

  const stageOption = {
    tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e4e4e7', textStyle: { color: '#3f3f46', fontSize: 12 } },
    grid: { top: 10, right: 20, bottom: 50, left: 40 },
    xAxis: { type: 'category', data: data.byStage.map(s => s.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#a1a1aa', fontSize: 10, rotate: 15 } },
    yAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#f4f4f5' } }, axisLabel: { color: '#a1a1aa', fontSize: 11 } },
    series: [{
      type: 'bar',
      data: data.byStage.map(s => s.value),
      barMaxWidth: 32,
      itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
    }],
  }

  return (
    <div className="space-y-5">
      {/* Summary totals */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Incidents', value: data.totals.incidents, color: 'text-[#1a1a2e]' },
          { label: 'Fatalities', value: data.totals.fatalities, color: 'text-red-600' },
          { label: 'Injured', value: data.totals.injured, color: 'text-orange-600' },
          { label: 'Arrested', value: data.totals.arrested, color: 'text-blue-600' },
        ].map(item => (
          <div key={item.label} className="glass-card p-5 text-center">
            <div className={`text-3xl font-bold ${item.color} mb-1`}>{item.value}</div>
            <div className="text-xs text-zinc-500">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-sm text-[#1a1a2e] mb-4">Incident Trend (Last 30 Days)</h3>
        {data.trend.length > 0 ? (
          <ReactECharts option={trendOption} style={{ height: 200 }} />
        ) : (
          <div className="h-48 flex items-center justify-center text-zinc-400 text-sm">No data yet — incidents will appear here once recorded</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Category donut */}
        <div className="glass-card p-5">
          <h3 className="font-semibold text-sm text-[#1a1a2e] mb-4">By Category</h3>
          <ReactECharts option={categoryOption} style={{ height: 280 }} />
        </div>

        {/* Stage bar */}
        <div className="glass-card p-5">
          <h3 className="font-semibold text-sm text-[#1a1a2e] mb-4">By Election Stage</h3>
          {data.byStage.length > 0 ? (
            <ReactECharts option={stageOption} style={{ height: 280 }} />
          ) : (
            <div className="h-64 flex items-center justify-center text-zinc-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Country bar */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-sm text-[#1a1a2e] mb-4">Top Countries by Incidents</h3>
        {data.byCountry.length > 0 ? (
          <ReactECharts option={countryOption} style={{ height: 250 }} />
        ) : (
          <div className="h-48 flex items-center justify-center text-zinc-400 text-sm">No data yet</div>
        )}
      </div>
    </div>
  )
}