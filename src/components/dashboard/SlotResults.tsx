"use client";

import { ListChecks } from "lucide-react";

import { cn } from "@/lib/ui";

import type { SlotResult, SlotResultSource } from "./types";
import { formatDateWithWeekday, formatMinute, sourceLabel } from "./utils";

type SlotResultsProps = {
  results: SlotResult[];
  duration: number;
};

const sourceStyles: Record<SlotResultSource, string> = {
  recurring: "border-accent/20 bg-accent-soft text-accent-strong",
  "override-replace": "border-violet/20 bg-violet/10 text-violet",
  "override-add": "border-teal/20 bg-teal/10 text-teal",
  unavailable: "border-danger/20 bg-danger/10 text-danger",
  "unavailable-override": "border-danger/20 bg-danger/10 text-danger",
  "no-availability": "border-border bg-surface text-muted",
};

export function SlotResults({ results, duration }: SlotResultsProps) {
  return (
    <section className="border-t border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-accent" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Slot Results</h2>
        </div>
        <span className="text-xs font-medium text-muted">{duration} minute appointments</span>
      </div>

      <div className="grid gap-3 px-5 pb-5 xl:grid-cols-2">
        {results.map((result) => (
          <article
            key={result.date}
            className="rounded-md border border-border bg-surface-muted p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {formatDateWithWeekday(result.date)}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {result.windows.length > 0
                    ? result.windows
                        .map((window) => `${formatMinute(window.startMinute)}-${formatMinute(window.endMinute)}`)
                        .join(", ")
                    : "No windows"}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold",
                  sourceStyles[result.source],
                )}
              >
                {sourceLabel(result.source)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.slots.length > 0 ? (
                result.slots.map((slot) => (
                  <span
                    key={`${result.date}-${slot}`}
                    className="rounded border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground"
                  >
                    {slot}
                  </span>
                ))
              ) : (
                <span className="text-xs font-medium text-muted">No available starts</span>
              )}
            </div>

            {result.message ? (
              <p className="mt-2 text-xs font-medium text-muted">{result.message}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
