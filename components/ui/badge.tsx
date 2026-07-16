import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide",
  {
    variants: {
      variant: {
        primary: "bg-primary/10 text-primary-700",
        accent: "bg-accent/20 text-accent-800",
        neutral: "bg-sand-100 text-sepia-700",
        ink: "bg-ink-900 text-white",
        outline: "border border-border bg-card text-foreground",
        brick: "bg-tile-50 text-tile-600",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
