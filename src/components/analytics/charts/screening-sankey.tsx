'use client'

import type { ReactNode } from 'react'
import { ChartFrame } from '../chart-frame'
import { buildScreeningSankey } from '@/lib/analytics/options/screening-sankey'
import type { FunnelFlow } from '@/lib/analytics/derive/screening'
import type { Viz } from '@/lib/analytics/types'

/**
 * One chart wrapper per visualisation, each about a dozen lines.
 *
 * A registry keyed by string would be shorter and would erase the types: the
 * builder would take `unknown` and a mismatch between a derivation and its
 * option builder would surface as a blank rectangle in production instead of a
 * type error here. These stay thin and typed.
 *
 * `children` is the server-rendered figures table, passed through untouched.
 */
export function ScreeningSankey({ viz, children }: { viz: Viz<FunnelFlow>; children: ReactNode }) {
  return (
    <ChartFrame
      id={viz.id}
      title={viz.title}
      caption={viz.caption}
      height={viz.series.nodes.length > 8 ? 460 : 340}
      unavailable={viz.unavailable}
      build={(palette) => buildScreeningSankey(viz.series, palette)}
    >
      {children}
    </ChartFrame>
  )
}
