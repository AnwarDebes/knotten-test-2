/** Shown while a portal page gathers its data (live prices and weather can take a moment). */
export default function PortalLoading() {
  return (
    <div className="grid gap-6 animate-pulse" aria-busy="true" aria-label="Laster">
      <div className="grid gap-3">
        <div className="h-3 w-24 rounded bg-bone/10" />
        <div className="h-9 w-72 max-w-full rounded bg-bone/10" />
        <div className="h-4 w-[min(560px,100%)] rounded bg-bone/10" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="panel h-[120px]" />)}
      </div>
      <div className="panel h-[260px]" />
    </div>
  );
}
