export default function MapLoading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#1a1a2e] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-zinc-400">Loading map...</p>
        <p className="text-xs text-zinc-300 mt-1">Fetching incident locations</p>
      </div>
    </div>
  )
}