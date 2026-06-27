"use server";

import { revalidatePath } from "next/cache";

import {
  createStaffMember,
  loadSampleScheduleIfEmpty,
  replaceDateOverrides,
  replaceWeeklyAvailability,
  updateStaffAvailabilityRange,
} from "@/db/queries";
import {
  mapDateOverrides,
  mapStaffSchedule,
  mapWeeklyWindows,
} from "@/lib/dashboard-data";
import type {
  AvailabilityWindow,
  DateOverride,
  ExplorerRange,
  StaffSchedule,
} from "@/components/dashboard/types";

export async function createStaffAction(name: string): Promise<StaffSchedule> {
  const staff = await createStaffMember(name);

  revalidatePath("/");
  return mapStaffSchedule(staff);
}

export async function loadSampleScheduleAction(): Promise<StaffSchedule[]> {
  const staffSchedules = await loadSampleScheduleIfEmpty();

  revalidatePath("/");
  return staffSchedules.map(mapStaffSchedule);
}

export async function saveWeeklyAvailabilityAction(
  staffId: string,
  windows: AvailabilityWindow[],
): Promise<AvailabilityWindow[]> {
  const persistedWindows = await replaceWeeklyAvailability(
    staffId,
    windows.map((window) => ({
      weekday: window.weekday,
      startMinute: window.startMinute,
      endMinute: window.endMinute,
    })),
  );

  revalidatePath("/");
  return mapWeeklyWindows(persistedWindows);
}

export async function saveAvailabilityRangeAction(
  staffId: string,
  range: ExplorerRange,
): Promise<ExplorerRange> {
  const staff = await updateStaffAvailabilityRange(staffId, range);

  revalidatePath("/");
  return {
    startDate: toDateString(staff.availabilityStartDate),
    endDate: toDateString(staff.availabilityEndDate),
  };
}

export async function saveDateOverridesAction(
  staffId: string,
  overrides: DateOverride[],
): Promise<DateOverride[]> {
  const persistedOverrides = await replaceDateOverrides(
    staffId,
    overrides.map((override) => ({
      overrideDate: override.date,
      mode: override.mode,
      reason: override.reason ?? null,
      windows: override.windows.map((window) => ({
        startMinute: window.startMinute,
        endMinute: window.endMinute,
      })),
    })),
  );

  revalidatePath("/");
  return mapDateOverrides(persistedOverrides);
}

function toDateString(date: Date | string | null) {
  if (!date) {
    throw new Error("Saved availability range is incomplete.");
  }

  if (typeof date === "string") {
    return date.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}
