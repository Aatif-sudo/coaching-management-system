export function LoadingSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10">
      <div className="h-7 w-7 animate-spin rounded-full border-4 border-sand border-t-bronze" />
      <p className="text-sm font-medium text-charcoal">{label}</p>
    </div>
  );
}

