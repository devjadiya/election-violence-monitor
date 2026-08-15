/** READ-ONLY: prove the public filter excludes every fabricated record. */
import { PrismaClient } from '../src/lib/generated/prisma'
import { readFileSync, existsSync } from 'node:fs'
for (const f of ['.env.local','.env']) { if(!existsSync(f))continue
  for (const raw of readFileSync(f,'utf8').split(/\r?\n/)) { const l=raw.trim()
    if(!l||l.startsWith('#'))continue; const e=l.indexOf('='); if(e<0)continue
    const k=l.slice(0,e).trim(); let v=l.slice(e+1).trim()
    if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1); if(!process.env[k])process.env[k]=v } }
async function main(){
  const { publicIncidentFilter, exportVisibilityFilter, searchVisibilityFilter } =
    await import('../src/lib/incidents/visibility')
  const prisma = new PrismaClient()
  const all = await prisma.incident.count()
  const pub = await prisma.incident.count({ where: publicIncidentFilter() })
  const exp = await prisma.incident.count({ where: exportVisibilityFilter(null) })
  const sea = await prisma.incident.count({ where: searchVisibilityFilter(null) })
  const analyst = await prisma.incident.count({
    where: exportVisibilityFilter({ userId:'x', role:'ANALYST' }) })
  console.log(`  incidents in database:            ${all}`)
  console.log(`  visible to public (list/map):     ${pub}`)
  console.log(`  visible to anonymous export:      ${exp}`)
  console.log(`  visible to anonymous search:      ${sea}`)
  console.log(`  visible to ANALYST export:        ${analyst}`)
  console.log('')
  console.log(pub === 0 ? '  PASS: no fabricated record reaches the public surface'
                        : `  FAIL: ${pub} fabricated record(s) still public`)
  await prisma.$disconnect()
  if (pub !== 0) process.exit(1)
}
main().catch(e=>{console.error(e.message);process.exit(1)})
