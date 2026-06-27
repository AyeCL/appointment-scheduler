"use client";

import {
  CalendarPlus,
  CircleMinus,
  Plus,
  PlusCircle,
  Repeat2,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/ui";

import { InfoTooltip } from "./InfoTooltip";
import type {
  AvailabilityWindow,
  DateOverride,
  OverrideMode,
  OverrideWindow,
} from "./types";
import {
  createLocalId,
  formatDateWithWeekday,
  formatMinute,
  getDefaultRange,
  minuteToTimeInput,
  sortWindows,
  sourceLabel,
  timeInputToMinute,
  validateAdditiveOverrides,
  validateWindows,
} from "./utils";

type OverrideEditorProps = {
  overrides: DateOverride[];
  weeklyWindows: AvailabilityWindow[];
  onChange: (overrides: DateOverride[]) => void;
};

const MODES: Array<{
  mode: OverrideMode;
  label: string;
  icon: typeof CircleMinus;
  activeClassName: string;
}> = [
  {
    mode: "unavailable",
    label: "Mark Unavailable",
    icon: CircleMinus,
    activeClassName: "border-warning bg-warning/10 text-warning",
  },
  {
    mode: "replace",
    label: "Custom Hours",
    icon: Repeat2,
    activeClassName: "border-violet bg-violet/10 text-violet",
  },
  {
    mode: "add",
    label: "Extra Hours",
    icon: PlusCircle,
    activeClassName: "border-teal bg-teal/10 text-teal",
  },
];

export function OverrideEditor({
  overrides,
  weeklyWindows,
  onChange,
}: OverrideEditorProps) {
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [date, setDate] = useState(defaultRange.startDate);
  const [mode, setMode] = useState<OverrideMode>("unavailable");
  const [reason, setReason] = useState("");
  const [windows, setWindows] = useState<OverrideWindow[]>([
    {
      id: createLocalId("override-window"),
      startMinute: 10 * 60,
      endMinute: 14 * 60,
    },
  ]);
  const [error, setError] = useState<string | null>(null);

  const existing = overrides.find((override) => override.date === date);
  const sortedOverrides = useMemo(
    () => [...overrides].sort((left, right) => left.date.localeCompare(right.date)),
    [overrides],
  );

  function saveOverride() {
    if (!date) {
      setError("Select a date.");
      return;
    }

    const activeWindows = mode === "unavailable" ? [] : sortWindows(windows);

    if (mode !== "unavailable" && activeWindows.length === 0) {
      setError("Add at least one window.");
      return;
    }

    const validationError = mode === "unavailable" ? null : validateWindows(activeWindows);

    if (validationError) {
      setError(validationError);
      return;
    }

    const nextOverride: DateOverride = {
      id: existing?.id ?? createLocalId("override"),
      date,
      mode,
      reason: reason.trim() || undefined,
      windows: activeWindows,
    };
    const overlapError = validateAdditiveOverrides([nextOverride], weeklyWindows);

    if (overlapError) {
      setError(overlapError);
      return;
    }

    setError(null);
    onChange([
      ...overrides.filter((override) => override.date !== date),
      nextOverride,
    ]);
  }

  function editOverride(override: DateOverride) {
    setDate(override.date);
    setMode(override.mode);
    setReason(override.reason ?? "");
    setWindows(
      override.windows.length > 0
        ? override.windows
        : [
            {
              id: createLocalId("override-window"),
              startMinute: 10 * 60,
              endMinute: 14 * 60,
            },
          ],
    );
    setError(null);
  }

  function updateWindow(windowId: string, patch: Partial<OverrideWindow>) {
    setWindows((current) =>
      current.map((window) => (window.id === windowId ? { ...window, ...patch } : window)),
    );
  }

  return (
    <section className="px-4 py-4">
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="text-sm font-semibold text-foreground">Date Adjustments</h2>
        <InfoTooltip label="About date adjustments">
          Create one-off changes for a specific date: mark unavailable, use custom hours, or add
          extra hours.
        </InfoTooltip>
      </div>

      <div className="space-y-3">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted">Change type</legend>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((option) => {
              const Icon = option.icon;

              return (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => setMode(option.mode)}
                  className={cn(
                    "inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border bg-surface px-2 py-2 text-center text-xs font-semibold leading-tight transition focus:outline-none focus:ring-2 focus:ring-accent-soft",
                    mode === option.mode
                      ? option.activeClassName
                      : "border-border text-muted hover:text-foreground",
                  )}
                  aria-pressed={mode === option.mode}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block text-xs font-medium text-muted">
          Date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </label>

        {mode === "unavailable" ? (
          <div className="rounded-md border border-warning/25 bg-warning/5 px-3 py-3 text-xs text-warning">
            <div className="flex items-start gap-2">
              <CircleMinus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>No appointments will be offered for this date.</span>
            </div>
          </div>
        ) : null}

        {mode !== "unavailable" ? (
          <div className="space-y-2">
            {windows.map((window) => (
              <div
                key={window.id}
                className="grid grid-cols-[1fr_auto_1fr_32px] items-center gap-2 rounded-md border border-border bg-surface px-2 py-1"
              >
                <label className="block">
                  <span className="sr-only">Date adjustment start</span>
                  <input
                    type="time"
                    value={minuteToTimeInput(window.startMinute)}
                    onChange={(event) =>
                      updateWindow(window.id, {
                        startMinute: timeInputToMinute(event.target.value),
                      })
                    }
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent-soft"
                  />
                </label>
                <span className="text-sm text-muted">to</span>
                <label className="block">
                  <span className="sr-only">Date adjustment end</span>
                  <input
                    type="time"
                    value={minuteToTimeInput(window.endMinute)}
                    onChange={(event) =>
                      updateWindow(window.id, {
                        endMinute: timeInputToMinute(event.target.value),
                      })
                    }
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent-soft"
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setWindows((current) => current.filter((candidate) => candidate.id !== window.id))
                  }
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-danger/10 hover:text-danger focus:outline-none focus:ring-2 focus:ring-accent-soft"
                  aria-label={`Remove date adjustment window ${formatMinute(window.startMinute)} to ${formatMinute(window.endMinute)}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setWindows((current) => [
                  ...current,
                  {
                    id: createLocalId("override-window"),
                    startMinute: 10 * 60,
                    endMinute: 14 * 60,
                  },
                ])
              }
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface text-sm font-medium text-accent transition hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-accent-soft"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add time window
            </button>
          </div>
        ) : null}

        <label className="block text-xs font-medium text-muted">
          Note
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional"
            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </label>

        {error ? (
          <p className="rounded-md border border-danger/25 bg-danger/5 px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={saveOverride}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-white transition hover:bg-foreground/90 focus:outline-none focus:ring-2 focus:ring-accent-soft"
        >
          <CalendarPlus className="size-4" aria-hidden="true" />
          {existing ? "Update change" : "Save change"}
        </button>
      </div>

      {sortedOverrides.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          {sortedOverrides.map((override) => {
            const label =
              override.mode === "unavailable"
                ? sourceLabel("unavailable")
                : sourceLabel(override.mode === "replace" ? "override-replace" : "override-add");

            return (
              <div
                key={override.id}
                className="rounded-md border border-border bg-surface-muted px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => editOverride(override)}
                    className="min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-accent-soft"
                  >
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {formatDateWithWeekday(override.date)}
                    </span>
                    <span className="text-xs text-muted">
                      {label}
                      {override.reason ? ` · ${override.reason}` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(overrides.filter((candidate) => candidate.id !== override.id))}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-surface hover:text-danger focus:outline-none focus:ring-2 focus:ring-accent-soft"
                    aria-label={`Delete date change for ${formatDateWithWeekday(override.date)}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
