export default function Loading() {
  return (
    <div className="md:ml-56 pt-14 pb-20 md:pb-6 min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto px-container-margin py-4 space-y-4 animate-pulse">
        <div className="h-8 bg-surface-dim rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-surface-dim rounded" />
          <div className="h-24 bg-surface-dim rounded" />
          <div className="h-24 bg-surface-dim rounded" />
        </div>
        <div className="h-64 bg-surface-dim rounded" />
      </div>
    </div>
  );
}
