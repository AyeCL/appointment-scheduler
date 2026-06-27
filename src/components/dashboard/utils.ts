import type {
  AvailabilitySource,
  AvailabilityWindow,
  DateOverride,
  ExplorerRange,
  OverrideWindow,
  SlotResult,
  SlotResultSource,
  Weekday,
} from "./types";
import {
  SchedulerValidationError,
  generateAvailability,
  type AvailabilitySource as SchedulerAvailabilitySource,
  type AvailabilityWindowSource,
  type LocalDateString,
} from "../../lib/scheduler";

export const DURATION_OPTIONS = [15, 30, 45, 60] as const;

export const DAY_OPTIONS: Array<{ weekday: Weekday; short: string; label: string }> = [
  { weekday: 1, short: "Mon", label: "Monday" },
  { weekday: 2, short: "Tue", label: "Tuesday" },
  { weekday: 3, short: "Wed", label: "Wednesday" },
  { weekday: 4, short: "Thu", label: "Thursday" },
  { weekday: 5, short: "Fri", label: "Friday" },
  { weekday: 6, short: "Sat", label: "Saturday" },
  { weekday: 0, short: "Sun", label: "Sunday" },
];

export const GRID_START_MINUTE = 7 * 60;
export const GRID_END_MINUTE = 19 * 60;
export const GRID_STEP_MINUTES = 15;

const SOURCE_LABELS: Record<SlotResultSource, string> = {
  recurring: "Weekly Hours",
  "override-replace": "Custom Hours",
  "override-add": "Extra Hours",
  unavailable: "Unavailable",
  "unavailable-override": "Unavailable Override",
  "no-availability": "No Availability",
};

export function sourceLabel(source: SlotResultSource) {
  return SOURCE_LABELS[source];
}

export function createLocalId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function snapMinute(minute: number) {
  return Math.round(minute / GRID_STEP_MINUTES) * GRID_STEP_MINUTES;
}

export function minuteToTimeInput(minute: number) {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timeInputToMinute(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function formatMinute(minute: number) {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatCompactMinute(minute: number) {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  const suffix = hours >= 12 ? "p" : "a";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0 ? `${hour12}${suffix}` : `${hour12}:${String(minutes).padStart(2, "0")}${suffix}`;
}

export function sortWindows<T extends { startMinute: number; endMinute: number }>(windows: T[]) {
  return [...windows].sort((left, right) => {
    if (left.startMinute !== right.startMinute) {
      return left.startMinute - right.startMinute;
    }

    return left.endMinute - right.endMinute;
  });
}

export function validateWindows(windows: Array<{ startMinute: number; endMinute: number }>) {
  const sorted = sortWindows(windows);

  for (let index = 0; index < sorted.length; index += 1) {
    const window = sorted[index];

    if (window.startMinute < 0 || window.endMinute > 24 * 60) {
      return "Times must stay within the day.";
    }

    if (window.startMinute >= window.endMinute) {
      return "End time must be after start time.";
    }

    const previous = sorted[index - 1];

    if (previous && previous.endMinute > window.startMinute) {
      return "Windows cannot overlap.";
    }
  }

  return null;
}

export function validateWeeklyWindows(windows: AvailabilityWindow[]) {
  for (const day of DAY_OPTIONS) {
    const error = validateWindows(windows.filter((window) => window.weekday === day.weekday));

    if (error) {
      return `${day.label} weekly hours: ${error}`;
    }
  }

  return null;
}

export function parseDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(Number.NaN);
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return new Date(Number.NaN);
  }

  return date;
}

export function toDateString(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function addDays(value: string, days: number) {
  const date = parseDateString(value);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

export function addMonths(value: string, months: number) {
  const date = parseDateString(value);
  const targetDay = date.getDate();

  date.setDate(1);
  date.setMonth(date.getMonth() + months);

  const lastDayOfTargetMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();

  date.setDate(Math.min(targetDay, lastDayOfTargetMonth));
  return toDateString(date);
}

export function getWeekStart(value: string) {
  const date = parseDateString(value);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return toDateString(date);
}

export function getWeekDates(weekStart: string) {
  return DAY_OPTIONS.map((_, index) => addDays(weekStart, index));
}

export function getDefaultRange(): ExplorerRange {
  const today = toDateString(new Date());

  return {
    startDate: today,
    endDate: addMonths(today, 1),
  };
}

export function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parseDateString(value));
}

export function formatDateWithWeekday(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parseDateString(value));
}

export function normalizeWeeklyWindows(windows: AvailabilityWindow[]) {
  return [...windows].sort((left, right) => {
    if (left.weekday !== right.weekday) {
      return left.weekday - right.weekday;
    }

    if (left.startMinute !== right.startMinute) {
      return left.startMinute - right.startMinute;
    }

    return left.endMinute - right.endMinute;
  });
}

export function generateSlots(windows: OverrideWindow[], duration: number) {
  return sortWindows(windows).flatMap((window) => {
    const slots: string[] = [];

    for (
      let startMinute = window.startMinute;
      startMinute + duration <= window.endMinute;
      startMinute += duration
    ) {
      slots.push(formatMinute(startMinute));
    }

    return slots;
  });
}

export function getEffectiveWindowsForDate(
  date: string,
  weeklyWindows: AvailabilityWindow[],
  overrides: DateOverride[],
) {
  const weekday = parseDateString(date).getDay() as Weekday;
  const recurring = weeklyWindows
    .filter((window) => window.weekday === weekday)
    .map((window) => ({ ...window, source: "recurring" as const }));
  const override = overrides.find((candidate) => candidate.date === date);

  if (!override) {
    return {
      source: recurring.length > 0 ? ("recurring" as const) : ("unavailable" as const),
      windows: recurring,
    };
  }

  if (override.mode === "unavailable") {
    return {
      source: "unavailable" as const,
      windows: [],
    };
  }

  const overrideSource = override.mode === "replace" ? "override-replace" : "override-add";
  const overrideWindows = override.windows.map((window) => ({
    ...window,
    weekday,
    source: overrideSource as AvailabilitySource,
  }));

  if (override.mode === "replace") {
    return {
      source: "override-replace" as const,
      windows: overrideWindows,
    };
  }

  return {
    source: "override-add" as const,
    windows: sortWindows([...recurring, ...overrideWindows]),
  };
}

export function generatePreviewResults(
  range: ExplorerRange,
  duration: number,
  weeklyWindows: AvailabilityWindow[],
  overrides: DateOverride[],
) {
  try {
    const staffId = "dashboard-preview";
    const overridesByDate = new Map(overrides.map((override) => [override.date, override]));
    const results = generateAvailability({
      staffId,
      startDate: range.startDate as LocalDateString,
      endDate: range.endDate as LocalDateString,
      duration,
      weeklyWindows: weeklyWindows.map((window) => ({
        staffId,
        weekday: window.weekday,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
      })),
      overrides: overrides.map((override) => ({
        staffId,
        date: override.date as LocalDateString,
        mode: override.mode,
        windows: override.windows.map((window) => ({
          startMinute: window.startMinute,
          endMinute: window.endMinute,
        })),
        message: override.reason,
      })),
    });

    return results.map((result) => {
      const override = overridesByDate.get(result.date);

      return {
        date: result.date,
        source: mapPreviewSource(result.source, override),
        windows: result.effectiveWindows.map((window, index) => ({
          id: `${result.date}-${index}`,
          startMinute: window.startMinute,
          endMinute: window.endMinute,
          source: mapWindowSource(window.source, override),
        })),
        slots: result.slots.map((slot) => formatMinute(slot.startMinute)),
        message: result.message,
      } satisfies SlotResult;
    });
  } catch (error) {
    const message =
      error instanceof SchedulerValidationError
        ? error.message
        : "Unable to calculate availability for this range.";

    return [
      {
        date: range.startDate,
        source: "unavailable",
        windows: [],
        slots: [],
        message,
      } satisfies SlotResult,
    ];
  }
}

export function validateRange(range: ExplorerRange) {
  if (!range.startDate || !range.endDate) {
    return "Choose a start date and end date.";
  }

  const start = parseDateString(range.startDate);
  const end = parseDateString(range.endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Choose valid dates.";
  }

  if (start > end) {
    return "Start date must be before or equal to end date.";
  }

  const dayCount =
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  if (dayCount > 366) {
    return "Date range can be up to one year.";
  }

  return null;
}

export function isDateWithinRange(date: string, range: ExplorerRange) {
  if (validateRange(range)) {
    return true;
  }

  return date >= range.startDate && date <= range.endDate;
}

export function validateAdditiveOverrides(
  overrides: DateOverride[],
  weeklyWindows: AvailabilityWindow[],
) {
  for (const override of overrides) {
    if (override.mode !== "add") {
      continue;
    }

    const weekday = parseDateString(override.date).getDay() as Weekday;
    const recurringWindows = weeklyWindows.filter((window) => window.weekday === weekday);

    for (const overrideWindow of override.windows) {
      const overlappingWindow = recurringWindows.find(
        (weeklyWindow) =>
          overrideWindow.startMinute < weeklyWindow.endMinute &&
          overrideWindow.endMinute > weeklyWindow.startMinute,
      );

      if (overlappingWindow) {
        return `Extra hours on ${formatDateWithWeekday(override.date)} overlap weekly hours (${formatMinute(
          overlappingWindow.startMinute,
        )}-${formatMinute(overlappingWindow.endMinute)}). Use custom hours to replace the day, or choose a non-overlapping extra window.`;
      }
    }
  }

  return null;
}

export function validateDateOverrides(
  overrides: DateOverride[],
  weeklyWindows: AvailabilityWindow[],
) {
  for (const override of overrides) {
    if (override.mode === "unavailable") {
      continue;
    }

    const error = validateWindows(override.windows);

    if (error) {
      const source =
        override.mode === "replace"
          ? sourceLabel("override-replace")
          : sourceLabel("override-add");

      return `${source} on ${formatDateWithWeekday(override.date)}: ${error}`;
    }
  }

  return validateAdditiveOverrides(overrides, weeklyWindows);
}

function mapPreviewSource(
  source: SchedulerAvailabilitySource,
  override?: DateOverride,
): SlotResultSource {
  if (override?.mode === "unavailable") {
    return "unavailable-override";
  }

  if (source === "no-availability") {
    return "no-availability";
  }

  if (override?.mode === "add" || source === "recurring-and-override") {
    return "override-add";
  }

  if (override?.mode === "replace" || source === "override") {
    return "override-replace";
  }

  return "recurring";
}

function mapWindowSource(
  source: AvailabilityWindowSource,
  override?: DateOverride,
): AvailabilitySource {
  if (source === "recurring") {
    return "recurring";
  }

  return override?.mode === "add" ? "override-add" : "override-replace";
}
