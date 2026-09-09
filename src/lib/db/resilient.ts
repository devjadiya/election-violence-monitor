/**
 * Reading the database from a page that is prerendered.
 *
 * Pages with `revalidate` are rendered once at build time and again on each
 * revalidation. That has two consequences worth designing for:
 *
 *  1. **The build needs the database.** CI builds with a placeholder
 *     `DATABASE_URL` pointing at nothing, by design — it has no secrets. A page
 *     that throws when the database is unreachable therefore fails the build,
 *     which is what happened when `/analytics` moved off `force-dynamic`.
 *
 *  2. **Production has an intermittently unreachable pooler.** The Supabase
 *     transaction pooler drops connections often enough that this repo already
 *     works around it in several places. A public page that 500s on a
 *     momentary outage is worse than one that renders and says the figures
 *     could not be read.
 *
 * Both want the same behaviour, so this is not a build workaround: a read that
 * fails should degrade to a stated absence, not take the page down. On Vercel
 * the database *is* reachable at build time, so production still prerenders
 * real figures.
 */

/** Run a read, returning `null` if the database could not be reached. */
export async function tryRead<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read()
  } catch (error) {
    // Logged rather than swallowed silently: a page rendering its "unavailable"
    // state is a fact worth having in the build and function logs.
    console.error(
      '[db] read failed, page will render its unavailable state:',
      error instanceof Error ? error.message : error
    )
    return null
  }
}
