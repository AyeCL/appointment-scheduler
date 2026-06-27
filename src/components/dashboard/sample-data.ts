import type {
  AvailabilityWindow,
  DashboardProps,
  DateOverride,
  StaffSchedule,
} from "./types";
import { addDays, getDefaultRange } from "./utils";

const range = getDefaultRange();

const staff = [
  {
    id: "staff-jane-smith",
    name: "Jane Smith",
    updatedAt: "Today",
  },
  {
    id: "staff-alex-rivera",
    name: "Alex Rivera",
    updatedAt: "Yesterday",
  },
];

const weeklyWindows: AvailabilityWindow[] = [
  {
    id: "weekly-mon-morning",
    weekday: 1,
    startMinute: 9 * 60,
    endMinute: 12 * 60,
  },
  {
    id: "weekly-mon-afternoon",
    weekday: 1,
    startMinute: 13 * 60,
    endMinute: 17 * 60,
  },
  {
    id: "weekly-wed-midday",
    weekday: 3,
    startMinute: 10 * 60,
    endMinute: 14 * 60,
  },
  {
    id: "weekly-thu-morning",
    weekday: 4,
    startMinute: 8 * 60,
    endMinute: 12 * 60,
  },
  {
    id: "weekly-fri-morning",
    weekday: 5,
    startMinute: 9 * 60,
    endMinute: 11 * 60,
  },
];

const overrides: DateOverride[] = [
  {
    id: "override-wed-unavailable",
    date: addDays(range.startDate, 2),
    mode: "unavailable",
    reason: "Clinic training",
    windows: [],
  },
  {
    id: "override-thu-extra",
    date: addDays(range.startDate, 3),
    mode: "add",
    reason: "Evening coverage",
    windows: [
      {
        id: "override-thu-extra-window",
        startMinute: 17 * 60,
        endMinute: 19 * 60,
      },
    ],
  },
  {
    id: "override-fri-replace",
    date: addDays(range.startDate, 4),
    mode: "replace",
    reason: "Short clinic day",
    windows: [
      {
        id: "override-fri-replace-window",
        startMinute: 10 * 60,
        endMinute: 14 * 60,
      },
    ],
  },
];

export const sampleDashboardProps: DashboardProps = {
  schedules: [
    {
      ...staff[0],
      weeklyWindows,
      overrides,
    },
    {
      ...staff[1],
      weeklyWindows: [],
      overrides: [],
    },
  ] satisfies StaffSchedule[],
  selectedStaffId: "staff-jane-smith",
  initialDuration: 30,
  initialRange: range,
};
