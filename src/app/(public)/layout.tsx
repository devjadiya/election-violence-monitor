// PublicLayout wraps all public pages.
// bg-mesh and min-h-screen are fine for content pages (homepage, reports, etc.)
// but the map page overrides with its own h-dvh overflow-hidden container,
// so this wrapper is neutral — it won't cause a scrollbar on the map page.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}