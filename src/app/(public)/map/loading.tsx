export default function Loading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-[var(--paper-2)]">
      <p className="text-[0.875rem] text-[var(--ink-3)]" role="status" aria-live="polite">
        Loading map…
      </p>
    </div>
  )
}
