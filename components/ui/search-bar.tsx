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
  size?: "md" | "lg";
  placeholder?: string;
  className?: string;
}) {
  const large = size === "lg";

  return (
    <form
      action={action}
      className={cn(
        "relative flex items-center rounded-input border border-border bg-card transition-shadow focus-within:ring-2 focus-within:ring-ring",
        large ? "h-14 px-5" : "h-11 px-3.5",
        className
      )}
    >
      <Search size={large ? 20 : 17} className="shrink-0 text-muted-foreground" />
      <input
        type="text"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={cn(
          "w-full bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none",
          large ? "px-4 text-base" : "px-2.5 text-sm"
        )}
      />
      <button
        type="submit"
        className={cn(
          "shrink-0 rounded-md bg-navy-900 font-semibold text-white transition-colors hover:bg-navy-800",
          large ? "px-5 py-2.5 text-sm" : "px-3 py-1.5 text-xs"
        )}
      >
        Ara
      </button>
    </form>
  );
}
