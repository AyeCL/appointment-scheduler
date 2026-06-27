"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/ui";

import { InfoTooltip } from "./InfoTooltip";
import type { AvailabilityWindow, OverrideWindow, Weekday } from "./types";
import {
  DAY_OPTIONS,
  createLocalId,
  formatMinute,
  minuteToTimeInput,
  sortWindows,
  timeInputToMinute,
  validateWindows,
} from "./utils";

type WeeklyAvailabilityEditorProps = {
  windows: AvailabilityWindow[];
  onChange: (windows: AvailabilityWindow[]) => void;
  onBulkApply: (weekdays: Weekday[], window: OverrideWindow) => void;
};

export function WeeklyAvailabilityEditor({
  windows,
  onChange,
  onBulkApply,
}: WeeklyAvailabilityEditorProps) {
  const [bulkDays, setBulkDays] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [bulkStart, setBulkStart] = useState("09:00");
  const [bulkEnd, setBulkEnd] = useState("17:00");
  const [bulkError, setBulkError] = useState<string | null>(null);

  const windowsByDay = useMemo(() => {
    return DAY_OPTIONS.map((day) => ({
      ...day,
      windows: sortWindows(windows.filter((window) => window.weekday === day.weekday)),
    }));
  }, [windows]);

  function updateWindow(windowId: string, patch: Partial<AvailabilityWindow>) {
    onChange(
      windows.map((window) => (window.id === windowId ? { ...window, ...patch } : window)),
    );
  }

  function addWindow(weekday: Weekday) {
    onChange([
      ...windows,
      {
        id: createLocalId("weekly"),
        weekday,
        startMinute: 10 * 60,
        endMinute: 18 * 60,
      },
    ]);
  }

  function removeDay(weekday: Weekday) {
    onChange(windows.filter((window) => window.weekday !== weekday));
  }

  function removeWindow(windowId: string) {
    onChange(windows.filter((window) => window.id !== windowId));
  }

  function applyBulk() {
    const startMinute = timeInputToMinute(bulkStart);
    const endMinute = timeInputToMinute(bulkEnd);
    const error = validateWindows([{ startMinute, endMinute }]);

    if (bulkDays.length === 0) {
      setBulkError("Select at least one day.");
      return;
    }

    if (error) {
      setBulkError(error);
      return;
    }

    setBulkError(null);

    const window: OverrideWindow = {
      id: createLocalId("bulk"),
      startMinute,
      endMinute,
    };

    onBulkApply(bulkDays, window);
  }

  return (
    <section className="border-b border-border px-4 py-4">
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="text-sm font-semibold text-foreground">Weekly Availability</h2>
        <InfoTooltip label="About weekly availability">
          Set the staff member&apos;s normal repeating weekly hours. Add multiple windows on a day
          when needed.
        </InfoTooltip>
      </div>

      <div className="space-y-1.5">
        {windowsByDay.map((day) => {
          const error = validateWindows(day.windows);
          const hasWindows = day.windows.length > 0;

          return (
            <div key={day.weekday}>
              {hasWindows ? (
                <div className="space-y-1.5">
                  <div className="rounded-md border border-border bg-surface px-2 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked
                        onChange={() => removeDay(day.weekday)}
                        className="size-4 shrink-0 accent-accent"
                        aria-label={`Disable ${day.label}`}
                      />
                      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                        {day.short}
                      </span>
                      <button
                        type="button"
                        onClick={() => addWindow(day.weekday)}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-surface-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft"
                        aria-label={`Add ${day.label} window`}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {day.windows.map((window) => (
                        <div
                          key={window.id}
                          className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_32px] items-center gap-1 text-xs"
                        >
                          <input
                            type="time"
                            value={minuteToTimeInput(window.startMinute)}
                            aria-label={`${day.label} start`}
                            onChange={(event) =>
                              updateWindow(window.id, {
                                startMinute: timeInputToMinute(event.target.value),
                              })
                            }
                            className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-center text-sm outline-none transition focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent-soft"
                          />
                          <span className="text-muted">-</span>
                          <input
                            type="time"
                            value={minuteToTimeInput(window.endMinute)}
                            aria-label={`${day.label} end`}
                            onChange={(event) =>
                              updateWindow(window.id, {
                                endMinute: timeInputToMinute(event.target.value),
                              })
                            }
                            className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-center text-sm outline-none transition focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent-soft"
                          />
                          <button
                            type="button"
                            onClick={() => removeWindow(window.id)}
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted transition hover:bg-danger/10 hover:text-danger focus:outline-none focus:ring-2 focus:ring-accent-soft"
                            aria-label={`Remove ${day.label} ${formatMinute(window.startMinute)} to ${formatMinute(window.endMinute)} window`}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-border bg-surface px-2 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => addWindow(day.weekday)}
                      className="size-4 shrink-0 accent-accent"
                      aria-label={`Enable ${day.label}`}
                    />
                    <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                      {day.short}
                    </span>
                    <button
                      type="button"
                      onClick={() => addWindow(day.weekday)}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-surface-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft"
                      aria-label={`Add ${day.label} window`}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <span className="mt-2 block pl-6 text-sm text-muted">
                    - Unavailable -
                  </span>
                </div>
              )}

              {error ? (
                <p className="mt-1 text-xs font-medium text-danger" aria-live="polite">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="mb-2 flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-foreground">Bulk Apply</h3>
          <InfoTooltip label="About bulk apply">
            Apply one time range to selected weekdays, replacing existing weekly windows for those
            days.
          </InfoTooltip>
        </div>

        <fieldset>
          <legend className="sr-only">Bulk apply weekdays</legend>
          <div className="grid grid-cols-7 gap-1">
            {DAY_OPTIONS.map((day) => {
              const isSelected = bulkDays.includes(day.weekday);

              return (
                <button
                  key={day.weekday}
                  type="button"
                  onClick={() => {
                    setBulkDays((current) =>
                      isSelected
                        ? current.filter((weekday) => weekday !== day.weekday)
                        : [...current, day.weekday],
                    );
                  }}
                  className={cn(
                    "h-8 rounded-md border text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-accent-soft",
                    isSelected
                      ? "border-accent bg-accent text-white"
                      : "border-border bg-surface text-muted hover:text-foreground",
                  )}
                  aria-pressed={isSelected}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-3 space-y-2">
          <span className="block text-sm font-medium text-foreground">Time Range</span>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <label className="block min-w-0 text-xs font-medium text-muted">
              <span className="sr-only">Bulk start</span>
              <input
                type="time"
                value={bulkStart}
                onChange={(event) => setBulkStart(event.target.value)}
                className="h-9 w-full min-w-0 rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
            <span className="text-sm text-muted">to</span>
            <label className="block min-w-0 text-xs font-medium text-muted">
              <span className="sr-only">Bulk end</span>
              <input
                type="time"
                value={bulkEnd}
                onChange={(event) => setBulkEnd(event.target.value)}
                className="h-9 w-full min-w-0 rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={applyBulk}
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-accent px-3 text-sm font-semibold text-white transition hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-soft"
            aria-label="Apply weekly availability to selected days"
          >
            Apply
          </button>
        </div>

        {bulkError ? (
          <p className="mt-2 text-xs font-medium text-danger" aria-live="polite">
            {bulkError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
