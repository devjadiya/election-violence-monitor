export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-8 bg-zinc-100 rounded-lg w-48" />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({length:6}).map((_,i) => (
          <div key={i} className="h-28 bg-zinc-100 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 h-64 bg-zinc-100 rounded-xl" />
        <div className="h-64 bg-zinc-100 rounded-xl" />
      </div>
    </div>
  )
}
