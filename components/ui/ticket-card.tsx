import { cn } from "@/lib/utils";

export function TicketCard({
  children,
  stub,
  className,
  bodyClassName,
  stubClassName,
  notchBg,
}: {
  children: React.ReactNode;
  stub?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  stubClassName?: string;
  /** "R G B" triplet (e.g. "6 32 40") the perforation notches should punch through to — match whatever sits behind the card. Defaults to the page background. */
  notchBg?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
      {stub && (
        <>
          <div
            className="ticket-perforation mx-5"
            style={notchBg ? ({ "--ticket-notch-bg": notchBg } as React.CSSProperties) : undefined}
          />
          <div
            className={cn(
              "flex items-center justify-between gap-3 bg-sand-50 px-5 py-4",
              stubClassName
            )}
          >
            {stub}
          </div>
        </>
      )}
    </div>
  );
}
