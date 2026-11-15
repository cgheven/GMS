"use client";
import { ChevronDown } from "lucide-react";
import { countryOptions } from "@/lib/country-config";
import { cn } from "@/lib/utils";

/**
 * Country picker for signup / onboarding / settings. A styled NATIVE <select> —
 * deliberately, not a Radix menu: the list is long, and native pickers are the
 * fastest and most accessible on mobile (where most Pulse owners are). Options
 * are sorted by name and show the international dial code.
 */
export function CountrySelect({
  value,
  onChange,
  disabled,
  id,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const options = countryOptions();
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "h-10 w-full appearance-none rounded-md border border-sidebar-border bg-background/50 px-3 pr-9 text-sm text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          className,
        )}
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name} (+{o.dialCode})
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
    </div>
  );
}
