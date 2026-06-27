"use client";

import { cn } from "@/lib/ui";

import { InfoTooltip } from "./InfoTooltip";
import type { ExplorerRange } from "./types";
import { DURATION_OPTIONS, validateRange } from "./utils";

type AvailabilityExplorerProps = {
  duration: number;
  range: ExplorerRange;
  onDurationChange: (duration: number) => void;
  onRangeChange: (range: ExplorerRange) => void;
};

export function AvailabilityExplorer({
  duration,
  range,
  onDurationChange,
  onRangeChange,
}: AvailabilityExplorerProps) {
  const rangeError = validateRange(range);

  return (
    <section className="border-b border-border px-4 py-4">
      <fieldset className="mb-4">
        <legend className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          Availability Range
          <InfoTooltip label="About availability range">
            Choose the dates used to generate appointment slots. The calendar view can still move
            week by week.
          </InfoTooltip>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-muted">
            Start
            <input
              type="date"
              value={range.startDate}
              onChange={(event) =>
                onRangeChange({
                  ...range,
                  startDate: event.target.value,
                })
              }
              aria-invalid={rangeError ? true : undefined}
              className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </label>
          <label className="block text-xs font-medium text-muted">
            End
            <input
              type="date"
              value={range.endDate}
              onChange={(event) =>
                onRangeChange({
                  ...range,
                  endDate: event.target.value,
                })
              }
              aria-invalid={rangeError ? true : undefined}
              className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </label>
        </div>
        {rangeError ? (
          <p className="mt-2 rounded-md border border-danger/25 bg-danger/5 px-3 py-2 text-xs font-medium text-danger">
            {rangeError}
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          Appointment Duration
          <InfoTooltip label="About appointment duration">
            Choose how long each appointment lasts. Available slots are generated from this duration.
          </InfoTooltip>
        </legend>
        <div className="grid grid-cols-4 overflow-hidden rounded-md border border-border bg-surface">
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onDurationChange(option)}
              className={cn(
                "h-9 border-r border-border text-sm font-medium transition last:border-r-0 focus:outline-none focus:ring-2 focus:ring-accent-soft",
                duration === option
                  ? "bg-accent text-white shadow-sm"
                  : "bg-surface text-foreground hover:bg-surface-muted",
              )}
              aria-pressed={duration === option}
            >
              {option} min
            </button>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
