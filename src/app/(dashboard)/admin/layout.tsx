import { redirect } from 'next/navigation'
import { getActor, hasPermission } from '@/lib/auth/guard'

/**
 * Everything under /admin requires ADMIN.
 *
 * Guarding the section rather than each page. `admin/users/new` is a client
 * component and had no server guard at all, so any signed-in account, down to
 * an OBSERVER, could open the account creation form. The API refused the
 * request, so nothing could actually be created, but a form that renders and
 * then always fails is indistinguishable from a broken permission model to the
 * person looking at it.
 *
 * A layout cannot be forgotten by a page added later, which is the reason to
 * put it here rather than repeating the check four times.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor()
  if (!actor || !hasPermission(actor.role, 'ADMIN')) redirect('/dashboard')
  return <>{children}</>
}
