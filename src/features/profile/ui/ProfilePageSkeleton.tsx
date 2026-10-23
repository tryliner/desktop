export function ProfilePageSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-8 animate-pulse space-y-8">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 pb-6 border-b border-border-subtle">
        <div className="w-24 h-24 rounded-full bg-bg-tertiary shrink-0" />
        <div className="flex-1 space-y-3 text-center md:text-left w-full">
          <div className="h-7 w-48 bg-bg-tertiary rounded-lg mx-auto md:mx-0" />
          <div className="h-4 w-28 bg-bg-tertiary rounded-md mx-auto md:mx-0" />
          <div className="h-4 w-72 bg-bg-tertiary rounded-md mx-auto md:mx-0" />
          <div className="flex justify-center md:justify-start gap-2 pt-2">
            <div className="h-6 w-24 bg-bg-tertiary rounded-full" />
            <div className="h-6 w-20 bg-bg-tertiary rounded-full" />
            <div className="h-6 w-24 bg-bg-tertiary rounded-full" />
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-4 border-b border-border-subtle pb-2">
        <div className="h-8 w-24 bg-bg-tertiary rounded-lg" />
        <div className="h-8 w-32 bg-bg-tertiary rounded-lg" />
        <div className="h-8 w-20 bg-bg-tertiary rounded-lg" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-square w-full rounded-2xl bg-bg-tertiary" />
            <div className="h-3 w-3/4 bg-bg-tertiary rounded" />
            <div className="h-2 w-1/2 bg-bg-tertiary rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProfilePageSkeleton;
