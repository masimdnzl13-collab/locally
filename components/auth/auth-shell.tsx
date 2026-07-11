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
    <section className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-slate-50 px-6 py-12 md:min-h-[calc(100dvh-4.5rem)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-extrabold text-primary-600">
            L
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-dark-900">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </div>
      </div>
    </section>
  );
}
