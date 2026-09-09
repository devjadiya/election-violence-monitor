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
        {/* `pb-24` on small screens clears the fixed bottom navigation, which
            was covering the last rows of every table. `overflow-x-hidden`
            stops a wide child from pushing the whole column sideways — tables
            scroll inside their own `.scroll-x` container instead. */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-24 sm:p-6 lg:pb-6">
          {children}
        </main>
      </div>
    </div>
  )
}