import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
  {
    variants: {
      variant: {
        neutral: "bg-stone-100 text-stone-700",
        navy: "bg-navy-900 text-white",
        teal: "bg-teal-50 text-teal-700",
        discount: "bg-discount-500 text-white",
        success: "bg-success-50 text-success-700",
        danger: "bg-danger-50 text-danger-700",
        outline: "border border-border bg-card text-foreground",
        overlay: "bg-white/95 text-navy-900 shadow-sm",
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
