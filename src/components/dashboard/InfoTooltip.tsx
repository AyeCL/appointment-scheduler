"use client";

import { Info } from "lucide-react";
import { useId } from "react";

type InfoTooltipProps = {
  label: string;
  children: string;
};

export function InfoTooltip({ label, children }: InfoTooltipProps) {
  const tooltipId = useId();

  return (
    <span className="group relative inline-flex shrink-0 items-center">
      <span
        tabIndex={0}
        aria-label={label}
        aria-describedby={tooltipId}
        className="inline-flex size-4 items-center justify-center rounded-full text-muted outline-none transition hover:text-foreground focus:text-foreground focus:ring-2 focus:ring-accent-soft"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-50 w-64 -translate-x-1/2 rounded-md border border-border bg-foreground px-3 py-2 text-left text-xs font-medium leading-5 text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
