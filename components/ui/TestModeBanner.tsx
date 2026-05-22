export function TestModeBanner() {
  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-900 shrink-0"
    >
      <span aria-hidden="true">⚠️</span>
      Test Mode is active — all data created will be marked as test data
    </div>
  )
}
