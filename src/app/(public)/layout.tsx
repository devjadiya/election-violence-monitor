export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="bg-mesh min-h-screen">{children}</div>
}