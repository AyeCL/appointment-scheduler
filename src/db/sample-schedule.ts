export const SAMPLE_JANE_ID = "7d1fd85c-44df-4772-b286-60845b9c8854";
export const SAMPLE_ALEX_ID = "6af8f5d7-0d85-464d-8900-5e42460c8878";

export const SAMPLE_RANGE = {
  startDate: "2026-05-25",
  endDate: "2026-05-29",
} as const;

export const SAMPLE_JANE_WEEKLY_WINDOWS = [
  { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 },
  { weekday: 1, startMinute: 13 * 60, endMinute: 17 * 60 },
  { weekday: 3, startMinute: 10 * 60, endMinute: 14 * 60 },
  { weekday: 5, startMinute: 9 * 60, endMinute: 11 * 60 },
] as const;

export const SAMPLE_JANE_OVERRIDES = [
  {
    overrideDate: "2026-05-27",
    mode: "unavailable",
    reason: "Unavailable all day",
    windows: [],
  },
  {
    overrideDate: "2026-05-28",
    mode: "replace",
    reason: "Custom availability",
    windows: [{ startMinute: 10 * 60, endMinute: 14 * 60 }],
  },
  {
    overrideDate: "2026-05-29",
    mode: "add",
    reason: "Extra evening hours",
    windows: [{ startMinute: 17 * 60, endMinute: 19 * 60 }],
  },
] as const;
