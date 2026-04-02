import { prisma } from '@/lib/db'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, email: true, role: true,
      isActive: true, createdAt: true,
      _count: { select: { createdIncidents: true } },
    },
  })

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-red-100 text-red-700',
    EDITOR: 'bg-purple-100 text-purple-700',
    REVIEWER: 'bg-blue-100 text-blue-700',
    ANALYST: 'bg-green-100 text-green-700',
    OBSERVER: 'bg-yellow-100 text-yellow-700',
    PUBLIC: 'bg-zinc-100 text-zinc-600',
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">Users</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{users.length} registered users</p>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">User</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Incidents</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Joined</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-zinc-600">
                        {user.name?.[0] ?? user.email[0]}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-zinc-800">{user.name ?? '—'}</div>
                      <div className="text-xs text-zinc-400">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[user.role] ?? 'bg-zinc-100 text-zinc-600'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-zinc-600">{user._count.createdIncidents}</td>
                <td className="px-5 py-3.5 text-xs text-zinc-400">{format(new Date(user.createdAt), 'MMM d, yyyy')}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}