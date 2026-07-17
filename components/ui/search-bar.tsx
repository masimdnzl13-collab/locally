import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchBar({
  defaultValue,
  action = "/kesfet",
  size = "md",
  placeholder = "İşletme veya kampanya ara",
  className,
}: {
  defaultValue?: string;
  action?: string;
  size?: "md" | "lg" | "xl";
  placeholder?: string;
  className?: string;
}) {
  const large = size === "lg";
  const xl = size === "xl";

  return (
    <form
      action={action}
      className={cn(
        "relative flex items-center border border-border bg-card transition-shadow focus-within:ring-2 focus-within:ring-ring",
        xl ? "h-[72px] rounded-full px-6" : large ? "h-14 rounded-input px-5" : "h-11 rounded-input px-3.5",
        className
      )}
    >
      <Search size={xl ? 22 : large ? 20 : 17} className="shrink-0 text-muted-foreground" />
      <input
        type="text"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={cn(
          "w-full bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none",
          xl ? "px-5 text-lg" : large ? "px-4 text-base" : "px-2.5 text-sm"
        )}
      />
      <button
        type="submit"
        className={cn(
          "shrink-0 rounded-full bg-navy-900 font-semibold text-white transition-colors hover:bg-navy-800",
          xl ? "px-7 py-4 text-base" : large ? "px-5 py-2.5 rounded-md text-sm" : "px-3 py-1.5 rounded-md text-xs"
        )}
      >
        Ara
      </button>
    </form>
  );
}
