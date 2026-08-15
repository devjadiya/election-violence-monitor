import { prisma } from '@/lib/db'
import { NewIncidentForm } from '@/components/incidents/new-incident-form'

export default async function NewIncidentPage() {
  const elections = await prisma.election.findMany({
    where: { isActive: true },
    orderBy: { electionDate: 'asc' },
    select: { id: true, name: true, country: true, electionType: true },
  })

  return <NewIncidentForm elections={elections} />
}