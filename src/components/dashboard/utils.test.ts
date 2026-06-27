import { describe, expect, test } from "vitest";

import {
  addMonths,
  isDateWithinRange,
  validateAdditiveOverrides,
  validateDateOverrides,
  validateRange,
  validateWeeklyWindows,
} from "./utils";
import type { AvailabilityWindow, DateOverride } from "./types";

describe("dashboard date range helpers", () => {
  test("adds one calendar month without overflowing shorter months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  test("validates start and end date order", () => {
    expect(
      validateRange({
        startDate: "2026-07-01",
        endDate: "2026-06-30",
      }),
    ).toBe("Start date must be before or equal to end date.");
  });

  test("checks whether a date falls inside the selected range", () => {
    const range = {
      startDate: "2026-06-27",
      endDate: "2026-06-30",
    };

    expect(isDateWithinRange("2026-06-30", range)).toBe(true);
    expect(isDateWithinRange("2026-07-01", range)).toBe(false);
  });
});

describe("validateAdditiveOverrides", () => {
  const weeklyWindows: AvailabilityWindow[] = [
    {
      id: "weekly-monday",
      weekday: 1,
      startMinute: 9 * 60,
      endMinute: 12 * 60,
    },
  ];

  test("rejects extra availability that overlaps recurring hours", () => {
    const overrides: DateOverride[] = [
      {
        id: "override-monday",
        date: "2026-06-29",
        mode: "add",
        windows: [
          {
            id: "overlap",
            startMinute: 10 * 60,
            endMinute: 11 * 60,
          },
        ],
      },
    ];

    expect(validateAdditiveOverrides(overrides, weeklyWindows)).toContain(
      "overlap weekly hours",
    );
  });

  test("allows extra availability outside recurring hours", () => {
    const overrides: DateOverride[] = [
      {
        id: "override-monday",
        date: "2026-06-29",
        mode: "add",
        windows: [
          {
            id: "evening",
            startMinute: 17 * 60,
            endMinute: 19 * 60,
          },
        ],
      },
    ];

    expect(validateAdditiveOverrides(overrides, weeklyWindows)).toBeNull();
  });
});

describe("availability overlap validation", () => {
  test("rejects overlapping weekly windows on the same weekday", () => {
    const windows: AvailabilityWindow[] = [
      {
        id: "morning",
        weekday: 1,
        startMinute: 9 * 60,
        endMinute: 12 * 60,
      },
      {
        id: "late-morning",
        weekday: 1,
        startMinute: 11 * 60,
        endMinute: 13 * 60,
      },
    ];

    expect(validateWeeklyWindows(windows)).toContain("Monday weekly hours");
  });

  test("allows weekly windows that touch without overlapping", () => {
    const windows: AvailabilityWindow[] = [
      {
        id: "morning",
        weekday: 1,
        startMinute: 9 * 60,
        endMinute: 12 * 60,
      },
      {
        id: "afternoon",
        weekday: 1,
        startMinute: 12 * 60,
        endMinute: 17 * 60,
      },
    ];

    expect(validateWeeklyWindows(windows)).toBeNull();
  });

  test("rejects overlapping custom hours on one date", () => {
    const overrides: DateOverride[] = [
      {
        id: "override-monday",
        date: "2026-06-29",
        mode: "replace",
        windows: [
          {
            id: "one",
            startMinute: 9 * 60,
            endMinute: 12 * 60,
          },
          {
            id: "two",
            startMinute: 11 * 60,
            endMinute: 13 * 60,
          },
        ],
      },
    ];

    expect(validateDateOverrides(overrides, [])).toContain("Custom Hours");
  });
});
