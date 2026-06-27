import { describe, expect, test } from "vitest";
import {
  SchedulerValidationError,
  buildWeeklyWindowsForWeekdays,
  generateAvailability,
  type AvailabilitySlot,
  type WeeklyAvailabilityWindow,
} from ".";

const staffId = "staff-1";

function weekly(
  weekday: WeeklyAvailabilityWindow["weekday"],
  startMinute: number,
  endMinute: number,
): WeeklyAvailabilityWindow {
  return { staffId, weekday, startMinute, endMinute };
}

function slotStarts(slots: AvailabilitySlot[]): number[] {
  return slots.map((slot) => slot.startMinute);
}

describe("generateAvailability", () => {
  test("generates 30 minute slots inside one window", () => {
    const [day] = generateAvailability({
      staffId,
      startDate: "2026-06-29",
      endDate: "2026-06-29",
      duration: 30,
      weeklyWindows: [weekly(1, 9 * 60, 11 * 60)],
    });

    expect(day.source).toBe("recurring");
    expect(day.sourceLabel).toBe("Recurring weekly availability");
    expect(slotStarts(day.slots)).toEqual([540, 570, 600, 630]);
  });

  test("generates 45 minute slots without exceeding the window end", () => {
    const [day] = generateAvailability({
      staffId,
      startDate: "2026-06-29",
      endDate: "2026-06-29",
      duration: 45,
      weeklyWindows: [weekly(1, 9 * 60, 11 * 60)],
    });

    expect(day.slots).toEqual([
      { startMinute: 540, endMinute: 585, source: "recurring" },
      { startMinute: 585, endMinute: 630, source: "recurring" },
    ]);
  });

  test("handles multiple windows on the same day", () => {
    const [day] = generateAvailability({
      staffId,
      startDate: "2026-06-29",
      endDate: "2026-06-29",
      duration: 30,
      weeklyWindows: [weekly(1, 9 * 60, 10 * 60), weekly(1, 13 * 60, 14 * 60)],
    });

    expect(day.effectiveWindows).toEqual([
      { startMinute: 540, endMinute: 600, source: "recurring" },
      { startMinute: 780, endMinute: 840, source: "recurring" },
    ]);
    expect(slotStarts(day.slots)).toEqual([540, 570, 780, 810]);
  });

  test("returns no availability when no recurring window or override exists", () => {
    const [day] = generateAvailability({
      staffId,
      startDate: "2026-06-30",
      endDate: "2026-06-30",
      duration: 30,
      weeklyWindows: [weekly(1, 9 * 60, 10 * 60)],
    });

    expect(day.source).toBe("no-availability");
    expect(day.sourceLabel).toBe("No availability");
    expect(day.effectiveWindows).toEqual([]);
    expect(day.slots).toEqual([]);
    expect(day.message).toBe("No recurring availability configured for this date.");
  });

  test("unavailable override removes recurring availability", () => {
    const [day] = generateAvailability({
      staffId,
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      duration: 30,
      weeklyWindows: [weekly(3, 9 * 60, 12 * 60)],
      overrides: [
        {
          staffId,
          date: "2026-07-01",
          mode: "unavailable",
          message: "Clinic holiday",
        },
      ],
    });

    expect(day.source).toBe("override");
    expect(day.sourceLabel).toBe("Date-specific override");
    expect(day.effectiveWindows).toEqual([]);
    expect(day.slots).toEqual([]);
    expect(day.message).toBe("Clinic holiday");
  });

  test("replace override uses override windows only", () => {
    const [day] = generateAvailability({
      staffId,
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      duration: 30,
      weeklyWindows: [weekly(3, 9 * 60, 12 * 60)],
      overrides: [
        {
          staffId,
          date: "2026-07-01",
          mode: "replace",
          windows: [{ startMinute: 10 * 60, endMinute: 11 * 60 }],
        },
      ],
    });

    expect(day.source).toBe("override");
    expect(day.effectiveWindows).toEqual([
      { startMinute: 600, endMinute: 660, source: "override" },
    ]);
    expect(slotStarts(day.slots)).toEqual([600, 630]);
  });

  test("add override combines recurring and override windows", () => {
    const [day] = generateAvailability({
      staffId,
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      duration: 30,
      weeklyWindows: [weekly(3, 9 * 60, 10 * 60)],
      overrides: [
        {
          staffId,
          date: "2026-07-01",
          mode: "add",
          windows: [{ startMinute: 10 * 60, endMinute: 11 * 60 }],
        },
      ],
    });

    expect(day.source).toBe("recurring-and-override");
    expect(day.sourceLabel).toBe("Recurring weekly availability + date-specific override");
    expect(day.effectiveWindows).toEqual([
      { startMinute: 540, endMinute: 600, source: "recurring" },
      { startMinute: 600, endMinute: 660, source: "override" },
    ]);
    expect(day.slots).toEqual([
      { startMinute: 540, endMinute: 570, source: "recurring" },
      { startMinute: 570, endMinute: 600, source: "recurring" },
      { startMinute: 600, endMinute: 630, source: "override" },
      { startMinute: 630, endMinute: 660, source: "override" },
    ]);
  });

  test("rejects add override windows that overlap recurring availability", () => {
    expect(() =>
      generateAvailability({
        staffId,
        startDate: "2026-07-01",
        endDate: "2026-07-01",
        duration: 30,
        weeklyWindows: [weekly(3, 9 * 60, 12 * 60)],
        overrides: [
          {
            staffId,
            date: "2026-07-01",
            mode: "add",
            windows: [{ startMinute: 11 * 60, endMinute: 13 * 60 }],
          },
        ],
      }),
    ).toThrow(/overlapping windows/);
  });

  test("rejects overlapping windows", () => {
    expect(() =>
      generateAvailability({
        staffId,
        startDate: "2026-06-29",
        endDate: "2026-06-29",
        duration: 30,
        weeklyWindows: [weekly(1, 9 * 60, 10 * 60), weekly(1, 9 * 60 + 30, 11 * 60)],
      }),
    ).toThrow(SchedulerValidationError);
  });

  test("rejects windows where end is before start", () => {
    expect(() =>
      generateAvailability({
        staffId,
        startDate: "2026-06-29",
        endDate: "2026-06-29",
        duration: 30,
        weeklyWindows: [weekly(1, 11 * 60, 10 * 60)],
      }),
    ).toThrow(/startMinute must be before endMinute/);
  });

  test.each(["replace", "add"] as const)("rejects empty %s override windows", (mode) => {
    expect(() =>
      generateAvailability({
        staffId,
        startDate: "2026-07-01",
        endDate: "2026-07-01",
        duration: 30,
        weeklyWindows: [weekly(3, 9 * 60, 10 * 60)],
        overrides: [{ staffId, date: "2026-07-01", mode, windows: [] }],
      }),
    ).toThrow(/require custom windows/);
  });

  test("rejects invalid durations", () => {
    expect(() =>
      generateAvailability({
        staffId,
        startDate: "2026-06-29",
        endDate: "2026-06-29",
        duration: 20,
        weeklyWindows: [weekly(1, 9 * 60, 10 * 60)],
      }),
    ).toThrow(/duration must be one of/);
  });

  test("rejects date ranges longer than one year", () => {
    expect(() =>
      generateAvailability({
        staffId,
        startDate: "2026-01-01",
        endDate: "2027-01-02",
        duration: 30,
        weeklyWindows: [],
      }),
    ).toThrow(/366 days/);
  });

  test("rejects duplicate overrides for the same staff and date", () => {
    expect(() =>
      generateAvailability({
        staffId,
        startDate: "2026-07-01",
        endDate: "2026-07-01",
        duration: 30,
        weeklyWindows: [],
        overrides: [
          { staffId, date: "2026-07-01", mode: "unavailable" },
          { staffId, date: "2026-07-01", mode: "unavailable" },
        ],
      }),
    ).toThrow(/Only one override/);
  });
});

describe("buildWeeklyWindowsForWeekdays", () => {
  test("builds validated windows for multiple weekdays", () => {
    expect(
      buildWeeklyWindowsForWeekdays({
        staffId,
        weekdays: [1, 2],
        windows: [{ startMinute: 9 * 60, endMinute: 10 * 60 }],
      }),
    ).toEqual([
      { staffId, weekday: 1, startMinute: 540, endMinute: 600 },
      { staffId, weekday: 2, startMinute: 540, endMinute: 600 },
    ]);
  });

  test("validates bulk-created weekly windows", () => {
    expect(() =>
      buildWeeklyWindowsForWeekdays({
        staffId,
        weekdays: [1, 2],
        windows: [
          { startMinute: 9 * 60, endMinute: 10 * 60 },
          { startMinute: 9 * 60 + 15, endMinute: 11 * 60 },
        ],
      }),
    ).toThrow(/overlapping windows/);
  });
});
