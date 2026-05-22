export function TestModeBanner() {
  return (
    <div
      role="alert"
      className="flex h-7 items-center justify-center gap-1.5 bg-amber-100 px-4 text-xs font-medium text-amber-800 shrink-0 border-b border-amber-200"
    >
      <span aria-hidden="true" className="text-[11px]">⚠</span>
      Test Mode active — data will be marked as test
    </div>
  )
}
