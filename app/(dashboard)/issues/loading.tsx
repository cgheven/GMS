export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-9 w-32 bg-white/5 rounded-lg" />
        <div className="h-9 w-32 bg-white/5 rounded-lg" />
      </div>
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-white/5 rounded-2xl" />)}
      </div>
    </div>
  );
}
