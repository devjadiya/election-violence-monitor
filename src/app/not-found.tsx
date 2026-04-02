import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-zinc-100 mb-2">404</div>
        <h1 className="text-xl font-bold text-zinc-800 mb-2">Page not found</h1>
        <p className="text-sm text-zinc-500 mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="bg-[#1a1a2e] text-white px-5 py-2.5 rounded-lg text-sm font-medium">
            Go Home
          </Link>
          <Link href="/dashboard" className="border border-zinc-200 text-zinc-600 px-5 py-2.5 rounded-lg text-sm font-medium">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
