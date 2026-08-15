import { redirect } from 'next/navigation'

/**
 * /reports was the public incident list before the information architecture was
 * reorganised. Redirected rather than deleted: the old paths are in the
 * sitemap and may be cited externally, and a citation that 404s is worse than
 * one that moves.
 */
export default function ReportsRedirect() {
  redirect('/incidents')
}
