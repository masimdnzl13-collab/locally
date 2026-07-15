import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide",
  {
    variants: {
      variant: {
        primary: "bg-primary/10 text-primary-700",
        accent: "bg-accent/15 text-accent-700",
        neutral: "bg-muted text-muted-foreground",
        dark: "bg-dark-950/85 text-white backdrop-blur-sm",
        outline: "border border-border bg-card/80 text-foreground backdrop-blur-sm",
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
