import type {
  AvailabilityWindow,
  BuildWeeklyWindowsInput,
  Weekday,
  WeeklyAvailabilityWindow,
} from "./types";
import { WEEKDAYS } from "./types";

export class SchedulerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulerValidationError";
  }
}

export function validateWindow<T extends AvailabilityWindow>(window: T, context = "window"): T {
  if (!Number.isInteger(window.startMinute) || !Number.isInteger(window.endMinute)) {
    throw new SchedulerValidationError(`${context} start and end must be whole minutes.`);
  }

  if (window.startMinute < 0 || window.startMinute > 1439) {
    throw new SchedulerValidationError(`${context} startMinute must be between 0 and 1439.`);
  }

  if (window.endMinute < 1 || window.endMinute > 1440) {
    throw new SchedulerValidationError(`${context} endMinute must be between 1 and 1440.`);
  }

  if (window.startMinute >= window.endMinute) {
    throw new SchedulerValidationError(`${context} startMinute must be before endMinute.`);
  }

  return window;
}

export function validateWindowList<T extends AvailabilityWindow>(
  windows: readonly T[],
  context = "windows",
): T[] {
  const validated = windows.map((window, index) => validateWindow(window, `${context}[${index}]`));
  const sorted = sortWindows(validated);

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];

    if (current.startMinute < previous.endMinute) {
      throw new SchedulerValidationError(`${context} cannot contain overlapping windows.`);
    }
  }

  return sorted;
}

export function buildWeeklyWindowsForWeekdays({
  staffId,
  weekdays,
  windows,
}: BuildWeeklyWindowsInput): WeeklyAvailabilityWindow[] {
  if (!staffId.trim()) {
    throw new SchedulerValidationError("staffId is required.");
  }

  const normalizedWeekdays = weekdays.map((weekday, index) =>
    validateWeekday(weekday, `weekdays[${index}]`),
  );
  const uniqueWeekdays = [...new Set(normalizedWeekdays)];
  const validatedWindows = validateWindowList(windows, "bulk windows");

  return uniqueWeekdays.flatMap((weekday) =>
    validatedWindows.map((window) => ({
      staffId,
      weekday,
      startMinute: window.startMinute,
      endMinute: window.endMinute,
    })),
  );
}

export function validateWeekday(value: number, context = "weekday"): Weekday {
  if (!Number.isInteger(value) || !WEEKDAYS.includes(value as Weekday)) {
    throw new SchedulerValidationError(`${context} must be an integer from 0 to 6.`);
  }

  return value as Weekday;
}

function sortWindows<T extends AvailabilityWindow>(windows: readonly T[]): T[] {
  return [...windows].sort(
    (left, right) => left.startMinute - right.startMinute || left.endMinute - right.endMinute,
  );
}
