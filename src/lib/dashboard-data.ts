import "server-only";

import type { StaffDashboard } from "@/db/queries";
import type {
  AvailabilityWindow,
  DateOverride,
  StaffSchedule,
  Weekday,
} from "@/components/dashboard/types";

type WeeklyWindowRow = StaffDashboard["weeklyAvailabilityWindows"][number];
type DateOverrideRow = StaffDashboard["dateOverrides"][number];

export function mapStaffSchedule(staff: StaffDashboard): StaffSchedule {
  return {
    id: staff.id,
    name: staff.name,
    updatedAt: formatUpdatedAt(staff.updatedAt),
    availabilityRange:
      staff.availabilityStartDate && staff.availabilityEndDate
        ? {
            startDate: toDateString(staff.availabilityStartDate),
            endDate: toDateString(staff.availabilityEndDate),
          }
        : undefined,
    weeklyWindows: mapWeeklyWindows(staff.weeklyAvailabilityWindows),
    overrides: mapDateOverrides(staff.dateOverrides),
  };
}

export function mapWeeklyWindows(windows: WeeklyWindowRow[]): AvailabilityWindow[] {
  return windows.map((window) => ({
    id: window.id,
    weekday: window.weekday as Weekday,
    startMinute: window.startMinute,
    endMinute: window.endMinute,
  }));
}

export function mapDateOverrides(overrides: DateOverrideRow[]): DateOverride[] {
  return overrides.map((override) => ({
    id: override.id,
    date: toDateString(override.overrideDate),
    mode: override.mode,
    reason: override.reason ?? undefined,
    windows: override.windows.map((window) => ({
      id: window.id,
      startMinute: window.startMinute,
      endMinute: window.endMinute,
    })),
  }));
}

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function toDateString(date: Date | string) {
  if (typeof date === "string") {
    return date.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}
