export default function AnalyticsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-8 bg-zinc-100 rounded-lg w-32" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({length:4}).map((_,i) => (<div key={i} className="h-24 bg-zinc-100 rounded-xl" />))}
      </div>
      <div className="h-56 bg-zinc-100 rounded-xl" />
      <div className="grid grid-cols-2 gap-5">
        <div className="h-72 bg-zinc-100 rounded-xl" />
        <div className="h-72 bg-zinc-100 rounded-xl" />
      </div>
    </div>
  )
}
