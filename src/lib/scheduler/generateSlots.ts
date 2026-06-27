import { assertLocalDate, eachLocalDateInRange, getLocalDateWeekday } from "./date";
import {
  APPOINTMENT_DURATIONS,
  type AppointmentDuration,
  type AvailabilitySource,
  type AvailabilitySlot,
  type DateAvailabilityOverride,
  type DateAvailabilityResult,
  type EffectiveAvailabilityWindow,
  type GenerateAvailabilityInput,
  type LocalDateString,
  type Weekday,
  type WeeklyAvailabilityWindow,
} from "./types";
import {
  SchedulerValidationError,
  validateWeekday,
  validateWindowList,
} from "./windows";

const SOURCE_LABELS: Record<AvailabilitySource, string> = {
  recurring: "Recurring weekly availability",
  override: "Date-specific override",
  "recurring-and-override": "Recurring weekly availability + date-specific override",
  "no-availability": "No availability",
};

export function generateAvailability({
  staffId,
  startDate,
  endDate,
  duration,
  weeklyWindows,
  overrides = [],
}: GenerateAvailabilityInput): DateAvailabilityResult[] {
  if (!staffId.trim()) {
    throw new SchedulerValidationError("staffId is required.");
  }

  const appointmentDuration = validateDuration(duration);
  const dates = eachLocalDateInRange(startDate, endDate);
  const weeklyByWeekday = groupWeeklyWindows(staffId, weeklyWindows);
  const overridesByDate = groupOverrides(staffId, overrides);

  return dates.map((date) => {
    const weekday = getLocalDateWeekday(date);
    const recurringWindows = weeklyByWeekday.get(weekday) ?? [];
    const override = overridesByDate.get(date);
    const { effectiveWindows, source } = resolveEffectiveWindows(recurringWindows, override);
    const validatedWindows = validateWindowList(effectiveWindows, `effective windows for ${date}`);
    const slots = generateSlotsForWindows(validatedWindows, appointmentDuration);

    return {
      date,
      weekday,
      source,
      sourceLabel: SOURCE_LABELS[source],
      effectiveWindows: validatedWindows,
      slots,
      message: buildResultMessage(source, validatedWindows, slots, override),
    };
  });
}

export function generateSlotsForWindows(
  windows: readonly EffectiveAvailabilityWindow[],
  duration: number,
): AvailabilitySlot[] {
  const appointmentDuration = validateDuration(duration);
  const validatedWindows = validateWindowList(windows, "slot windows");

  return validatedWindows.flatMap((window) => {
    const slots: AvailabilitySlot[] = [];

    for (
      let startMinute = window.startMinute;
      startMinute + appointmentDuration <= window.endMinute;
      startMinute += appointmentDuration
    ) {
      slots.push({
        startMinute,
        endMinute: startMinute + appointmentDuration,
        source: window.source,
      });
    }

    return slots;
  });
}

function validateDuration(duration: number): AppointmentDuration {
  if (!APPOINTMENT_DURATIONS.includes(duration as AppointmentDuration)) {
    throw new SchedulerValidationError("duration must be one of 15, 30, 45, or 60 minutes.");
  }

  return duration as AppointmentDuration;
}

function groupWeeklyWindows(
  staffId: string,
  weeklyWindows: readonly WeeklyAvailabilityWindow[],
): Map<Weekday, EffectiveAvailabilityWindow[]> {
  const groups = new Map<Weekday, EffectiveAvailabilityWindow[]>();

  for (const window of weeklyWindows) {
    if (window.staffId !== staffId) {
      continue;
    }

    const weekday = validateWeekday(window.weekday, "weekly window weekday");
    const existing = groups.get(weekday) ?? [];

    existing.push({
      startMinute: window.startMinute,
      endMinute: window.endMinute,
      source: "recurring",
    });
    groups.set(weekday, existing);
  }

  for (const [weekday, windows] of groups.entries()) {
    groups.set(weekday, validateWindowList(windows, `weekly windows for weekday ${weekday}`));
  }

  return groups;
}

function groupOverrides(
  staffId: string,
  overrides: readonly DateAvailabilityOverride[],
): Map<LocalDateString, DateAvailabilityOverride> {
  const groups = new Map<LocalDateString, DateAvailabilityOverride>();

  for (const override of overrides) {
    if (override.staffId !== staffId) {
      continue;
    }

    assertLocalDate(override.date, "override date");

    if (groups.has(override.date)) {
      throw new SchedulerValidationError(
        `Only one override is allowed for staff ${staffId} on ${override.date}.`,
      );
    }

    const windows = override.windows ?? [];

    if (override.mode === "unavailable") {
      if (windows.length > 0) {
        throw new SchedulerValidationError("unavailable overrides cannot include windows.");
      }
    } else {
      if (windows.length === 0) {
        throw new SchedulerValidationError(`${override.mode} overrides require custom windows.`);
      }

      validateWindowList(windows, `${override.mode} override windows for ${override.date}`);
    }

    groups.set(override.date, override);
  }

  return groups;
}

function resolveEffectiveWindows(
  recurringWindows: readonly EffectiveAvailabilityWindow[],
  override?: DateAvailabilityOverride,
): {
  effectiveWindows: EffectiveAvailabilityWindow[];
  source: AvailabilitySource;
} {
  if (!override) {
    return {
      effectiveWindows: [...recurringWindows],
      source: recurringWindows.length > 0 ? "recurring" : "no-availability",
    };
  }

  if (override.mode === "unavailable") {
    return {
      effectiveWindows: [],
      source: "override",
    };
  }

  const overrideWindows = (override.windows ?? []).map((window) => ({
    startMinute: window.startMinute,
    endMinute: window.endMinute,
    source: "override" as const,
  }));

  if (override.mode === "replace") {
    return {
      effectiveWindows: overrideWindows,
      source: "override",
    };
  }

  return {
    effectiveWindows: [...recurringWindows, ...overrideWindows],
    source: recurringWindows.length > 0 ? "recurring-and-override" : "override",
  };
}

function buildResultMessage(
  source: AvailabilitySource,
  effectiveWindows: readonly EffectiveAvailabilityWindow[],
  slots: readonly AvailabilitySlot[],
  override?: DateAvailabilityOverride,
): string | undefined {
  if (override?.mode === "unavailable") {
    return override.message ?? "Date-specific override marks this date unavailable.";
  }

  if (effectiveWindows.length === 0) {
    return source === "no-availability"
      ? "No recurring availability configured for this date."
      : "No availability configured for this date.";
  }

  if (slots.length === 0) {
    return "No slots fit the selected duration.";
  }

  return override?.message;
}
