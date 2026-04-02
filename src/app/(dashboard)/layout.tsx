import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { TopBar } from '@/components/layout/topbar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <SidebarNav user={session.user as any} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar user={session.user as any} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}