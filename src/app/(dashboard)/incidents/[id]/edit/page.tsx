import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { EditIncidentForm } from '@/components/incidents/edit-incident-form'

export default async function EditIncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [incident, elections] = await Promise.all([
    prisma.incident.findUnique({
      where: { id },
      include: { sources: true },
    }),
    prisma.election.findMany({
      where: { isActive: true },
      select: { id: true, name: true, country: true },
    }),
  ])

  if (!incident) notFound()

  return <EditIncidentForm incident={incident} elections={elections} />
}