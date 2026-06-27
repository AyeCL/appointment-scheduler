import "server-only";

import type { OverrideMode, Prisma } from "@/generated/prisma/client";

import { getPrismaClient } from "./client";
import {
  SAMPLE_ALEX_ID,
  SAMPLE_JANE_ID,
  SAMPLE_JANE_OVERRIDES,
  SAMPLE_JANE_WEEKLY_WINDOWS,
  SAMPLE_RANGE,
} from "./sample-schedule";

const MINUTES_PER_DAY = 24 * 60;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const VALID_OVERRIDE_MODES = ["unavailable", "replace", "add"] as const;

const staffDashboardInclude = {
  weeklyAvailabilityWindows: {
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
  },
  dateOverrides: {
    include: {
      windows: {
        orderBy: { startMinute: "asc" },
      },
    },
    orderBy: { overrideDate: "asc" },
  },
} satisfies Prisma.StaffMemberInclude;

export type MinuteWindowInput = {
  startMinute: number;
  endMinute: number;
};

export type WeeklyAvailabilityWindowInput = MinuteWindowInput & {
  weekday: number;
};

export type DateOverrideInput = {
  overrideDate: Date | string;
  mode: OverrideMode;
  reason?: string | null;
  windows?: MinuteWindowInput[];
};

export type AvailabilityRangeInput = {
  startDate: string;
  endDate: string;
};

export type StaffDashboard = Prisma.StaffMemberGetPayload<{
  include: typeof staffDashboardInclude;
}>;

export async function listStaffMembers() {
  const prisma = getPrismaClient();

  return prisma.staffMember.findMany({
    orderBy: { name: "asc" },
  });
}

export async function listAllDashboardData(selectedStaffId?: string) {
  const prisma = getPrismaClient();
  const staffSchedules = await prisma.staffMember.findMany({
    include: staffDashboardInclude,
    orderBy: { name: "asc" },
  });
  const firstConfiguredStaff = staffSchedules.find(
    (staff) => staff.weeklyAvailabilityWindows.length > 0,
  );

  return {
    staffSchedules,
    selectedStaffId: selectedStaffId ?? firstConfiguredStaff?.id ?? staffSchedules[0]?.id,
  };
}

export async function listDashboardData(staffId?: string) {
  const prisma = getPrismaClient();

  const staffMembers = await listStaffMembers();
  const selectedStaffId = staffId ?? staffMembers[0]?.id;
  const selectedStaff = selectedStaffId
    ? await prisma.staffMember.findUnique({
        where: { id: selectedStaffId },
        include: staffDashboardInclude,
      })
    : null;

  return {
    staffMembers,
    selectedStaff,
  };
}

export async function createStaffMember(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Staff name is required.");
  }

  const prisma = getPrismaClient();

  return prisma.staffMember.create({
    data: {
      name: trimmedName,
    },
    include: staffDashboardInclude,
  });
}

export async function loadSampleScheduleIfEmpty() {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const staffCount = await tx.staffMember.count();

    if (staffCount === 0) {
      await createSampleSchedule(tx);
    }

    return tx.staffMember.findMany({
      include: staffDashboardInclude,
      orderBy: { name: "asc" },
    });
  });
}

export async function updateStaffAvailabilityRange(
  staffId: string,
  range: AvailabilityRangeInput,
) {
  const availabilityStartDate = toDateOnly(range.startDate, "Availability start date");
  const availabilityEndDate = toDateOnly(range.endDate, "Availability end date");

  validateAvailabilityRange(availabilityStartDate, availabilityEndDate);

  const prisma = getPrismaClient();

  return prisma.staffMember.update({
    where: { id: staffId },
    data: {
      availabilityStartDate,
      availabilityEndDate,
    },
  });
}

export async function replaceWeeklyAvailability(
  staffId: string,
  windows: WeeklyAvailabilityWindowInput[],
) {
  validateWeeklyWindows(windows);
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const additiveOverrides = await tx.dateOverride.findMany({
      where: {
        staffId,
        mode: "add",
      },
      include: {
        windows: true,
      },
    });

    validateAdditiveOverridesAgainstWeekly(additiveOverrides, windows);

    await tx.weeklyAvailabilityWindow.deleteMany({
      where: { staffId },
    });

    if (windows.length > 0) {
      await tx.weeklyAvailabilityWindow.createMany({
        data: windows.map((window) => ({
          staffId,
          weekday: window.weekday,
          startMinute: window.startMinute,
          endMinute: window.endMinute,
        })),
      });
    }

    return tx.weeklyAvailabilityWindow.findMany({
      where: { staffId },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    });
  });
}

export async function replaceDateOverrides(
  staffId: string,
  inputs: DateOverrideInput[],
) {
  const normalizedInputs = normalizeDateOverrides(inputs);
  const prisma = getPrismaClient();
  const weeklyWindows = await prisma.weeklyAvailabilityWindow.findMany({
    where: { staffId },
  });

  validateAdditiveOverridesAgainstWeekly(normalizedInputs, weeklyWindows);

  return prisma.$transaction(async (tx) => {
    await tx.dateOverride.deleteMany({
      where: { staffId },
    });

    for (const input of normalizedInputs) {
      await tx.dateOverride.create({
        data: {
          staffId,
          overrideDate: input.overrideDate,
          mode: input.mode,
          reason: input.reason,
          windows:
            input.windows.length > 0
              ? {
                  create: input.windows.map((window) => ({
                    startMinute: window.startMinute,
                    endMinute: window.endMinute,
                  })),
                }
              : undefined,
        },
      });
    }

    return tx.dateOverride.findMany({
      where: { staffId },
      include: {
        windows: {
          orderBy: { startMinute: "asc" },
        },
      },
      orderBy: { overrideDate: "asc" },
    });
  });
}

export async function replaceDateOverride(
  staffId: string,
  input: DateOverrideInput,
) {
  const overrideDate = toDateOnly(input.overrideDate);
  const windows = input.windows ?? [];

  validateOverride(input.mode, windows);
  const prisma = getPrismaClient();
  const weeklyWindows = await prisma.weeklyAvailabilityWindow.findMany({
    where: { staffId },
  });

  validateAdditiveOverridesAgainstWeekly(
    [
      {
        overrideDate,
        mode: input.mode,
        windows,
      },
    ],
    weeklyWindows,
  );

  return prisma.$transaction(async (tx) => {
    await tx.dateOverride.deleteMany({
      where: {
        staffId,
        overrideDate,
      },
    });

    return tx.dateOverride.create({
      data: {
        staffId,
        overrideDate,
        mode: input.mode,
        reason: input.reason ?? null,
        windows:
          windows.length > 0
            ? {
                create: windows.map((window) => ({
                  startMinute: window.startMinute,
                  endMinute: window.endMinute,
                })),
              }
            : undefined,
      },
      include: {
        windows: {
          orderBy: { startMinute: "asc" },
        },
      },
    });
  });
}

function validateWeeklyWindows(windows: WeeklyAvailabilityWindowInput[]) {
  for (const window of windows) {
    if (!Number.isInteger(window.weekday) || window.weekday < 0 || window.weekday > 6) {
      throw new Error("Weekday must be an integer from 0 to 6.");
    }
  }

  for (const weekday of new Set(windows.map((window) => window.weekday))) {
    validateMinuteWindows(windows.filter((window) => window.weekday === weekday));
  }
}

async function createSampleSchedule(tx: Prisma.TransactionClient) {
  const availabilityStartDate = toDateOnly(SAMPLE_RANGE.startDate, "Sample start date");
  const availabilityEndDate = toDateOnly(SAMPLE_RANGE.endDate, "Sample end date");

  await tx.staffMember.upsert({
    where: { id: SAMPLE_JANE_ID },
    update: {
      name: "Jane Smith",
      availabilityStartDate,
      availabilityEndDate,
    },
    create: {
      id: SAMPLE_JANE_ID,
      name: "Jane Smith",
      availabilityStartDate,
      availabilityEndDate,
    },
  });

  await tx.staffMember.upsert({
    where: { id: SAMPLE_ALEX_ID },
    update: {
      name: "Alex Rivera",
      availabilityStartDate: null,
      availabilityEndDate: null,
    },
    create: {
      id: SAMPLE_ALEX_ID,
      name: "Alex Rivera",
    },
  });

  await tx.weeklyAvailabilityWindow.deleteMany({
    where: { staffId: { in: [SAMPLE_JANE_ID, SAMPLE_ALEX_ID] } },
  });
  await tx.dateOverride.deleteMany({
    where: { staffId: { in: [SAMPLE_JANE_ID, SAMPLE_ALEX_ID] } },
  });

  await tx.weeklyAvailabilityWindow.createMany({
    data: SAMPLE_JANE_WEEKLY_WINDOWS.map((window) => ({
      staffId: SAMPLE_JANE_ID,
      weekday: window.weekday,
      startMinute: window.startMinute,
      endMinute: window.endMinute,
    })),
  });

  for (const override of SAMPLE_JANE_OVERRIDES) {
    await tx.dateOverride.create({
      data: {
        staffId: SAMPLE_JANE_ID,
        overrideDate: toDateOnly(override.overrideDate, "Sample override date"),
        mode: override.mode,
        reason: override.reason,
        windows:
          override.windows.length > 0
            ? {
                create: override.windows.map((window) => ({
                  startMinute: window.startMinute,
                  endMinute: window.endMinute,
                })),
              }
            : undefined,
      },
    });
  }
}

function normalizeDateOverrides(inputs: DateOverrideInput[]) {
  const seenDates = new Set<string>();

  return inputs
    .map((input) => {
      const overrideDate = toDateOnly(input.overrideDate);
      const dateKey = overrideDate.toISOString().slice(0, 10);
      const windows = input.windows ?? [];

      if (seenDates.has(dateKey)) {
        throw new Error("Only one override is allowed per date.");
      }

      seenDates.add(dateKey);
      validateOverride(input.mode, windows);

      return {
        overrideDate,
        mode: input.mode,
        reason: input.reason?.trim() || null,
        windows,
      };
    })
    .sort((left, right) => left.overrideDate.getTime() - right.overrideDate.getTime());
}

function validateOverride(mode: OverrideMode, windows: MinuteWindowInput[]) {
  if (!VALID_OVERRIDE_MODES.includes(mode)) {
    throw new Error("Override mode must be unavailable, replace, or add.");
  }

  if (mode === "unavailable" && windows.length > 0) {
    throw new Error("Unavailable overrides cannot include availability windows.");
  }

  if (mode !== "unavailable" && windows.length === 0) {
    throw new Error("Replace and add overrides require at least one availability window.");
  }

  validateMinuteWindows(windows);
}

function validateAdditiveOverridesAgainstWeekly(
  overrides: Array<{
    overrideDate: Date;
    mode: OverrideMode;
    windows: MinuteWindowInput[];
  }>,
  weeklyWindows: WeeklyAvailabilityWindowInput[],
) {
  for (const override of overrides) {
    if (override.mode !== "add") {
      continue;
    }

    const weekday = override.overrideDate.getUTCDay();
    const recurringWindows = weeklyWindows.filter((window) => window.weekday === weekday);

    for (const overrideWindow of override.windows) {
      const hasOverlap = recurringWindows.some(
        (weeklyWindow) =>
          overrideWindow.startMinute < weeklyWindow.endMinute &&
          overrideWindow.endMinute > weeklyWindow.startMinute,
      );

      if (hasOverlap) {
        throw new Error(
          "Extra availability windows cannot overlap recurring weekly availability. Use replace mode for custom hours on that date.",
        );
      }
    }
  }
}

function validateMinuteWindows(windows: MinuteWindowInput[]) {
  for (const window of windows) {
    validateMinuteWindow(window);
  }

  const sorted = [...windows].sort((a, b) => a.startMinute - b.startMinute);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index - 1].endMinute > sorted[index].startMinute) {
      throw new Error("Availability windows cannot overlap.");
    }
  }
}

function validateMinuteWindow(window: MinuteWindowInput) {
  if (
    !Number.isInteger(window.startMinute) ||
    !Number.isInteger(window.endMinute) ||
    window.startMinute < 0 ||
    window.startMinute >= MINUTES_PER_DAY ||
    window.endMinute <= 0 ||
    window.endMinute > MINUTES_PER_DAY
  ) {
    throw new Error("Availability window minutes must be valid minute-of-day integers.");
  }

  if (window.startMinute >= window.endMinute) {
    throw new Error("Availability window startMinute must be before endMinute.");
  }
}

function validateAvailabilityRange(start: Date, end: Date) {
  if (start > end) {
    throw new Error("Start date must be before or equal to end date.");
  }

  const dayCount =
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  if (dayCount > 366) {
    throw new Error("Date range can be up to one year.");
  }
}

function toDateOnly(value: Date | string, fieldName = "Override date") {
  if (typeof value === "string") {
    const match = DATE_PATTERN.exec(value);

    if (!match) {
      throw new Error(`${fieldName} must use YYYY-MM-DD format.`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new Error(`${fieldName} must be a valid calendar date.`);
    }

    return date;
  }

  if (Number.isNaN(value.getTime())) {
    throw new Error(`${fieldName} must be a valid calendar date.`);
  }

  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}
