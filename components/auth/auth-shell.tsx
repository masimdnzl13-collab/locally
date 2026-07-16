export default function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background px-6 py-12 md:min-h-[calc(100dvh-4.5rem)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card text-2xl font-semibold text-teal-700">
            L
          </div>
          <h1 className="font-serif text-2xl italic tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-3 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-card">
          {children}
        </div>
      </div>
    </section>
  );
}
