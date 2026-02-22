export function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-sand bg-mist px-6 py-10 text-center">
      <p className="font-display text-lg text-charcoal">{title}</p>
      {subtitle ? <p className="mt-1 text-sm text-charcoal/70">{subtitle}</p> : null}
    </div>
  );
}

