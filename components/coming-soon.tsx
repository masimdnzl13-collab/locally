export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center px-6 text-center md:min-h-[calc(100dvh-4.5rem)]">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 font-display text-3xl font-semibold text-primary-600">
        L
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-900">
        {title}
      </h1>
      <p className="mt-3 max-w-sm text-balance text-sm text-muted-foreground">
        {description}
      </p>
    </section>
  );
}
