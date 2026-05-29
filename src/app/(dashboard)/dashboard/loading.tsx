export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-surface-dim rounded w-32" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="h-28 bg-surface-dim rounded" />
        <div className="h-28 bg-surface-dim rounded" />
        <div className="h-28 bg-surface-dim rounded" />
        <div className="h-28 bg-surface-dim rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-80 bg-surface-dim rounded" />
        <div className="h-80 bg-surface-dim rounded" />
      </div>
    </div>
  );
}
