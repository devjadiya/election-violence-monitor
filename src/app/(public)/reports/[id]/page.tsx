import { redirect } from 'next/navigation'

export default async function ReportRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/incidents/${id}`)
}
