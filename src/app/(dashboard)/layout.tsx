import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { TopBar } from '@/components/layout/topbar'
import type { UserRole } from '@/lib/generated/prisma'

/** What the session actually carries, rather than casting it away twice. */
interface SessionUser {
  name?: string | null
  email?: string | null
  role?: UserRole
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const user = session.user as SessionUser

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--paper-2)]">
      <SidebarNav user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}