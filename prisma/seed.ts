import { PrismaPg } from "@prisma/adapter-pg";
import { userInfo } from "node:os";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  SAMPLE_ALEX_ID,
  SAMPLE_JANE_ID,
  SAMPLE_JANE_OVERRIDES,
  SAMPLE_JANE_WEEKLY_WINDOWS,
  SAMPLE_RANGE,
} from "../src/db/sample-schedule";

const localDatabaseUser = encodeURIComponent(
  process.env.PGUSER ??
    process.env.USER ??
    process.env.LOGNAME ??
    userInfo().username,
);
const localDatabaseUrl = `postgresql://${localDatabaseUser}@localhost:5432/vironix_appointment_scheduler`;

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? localDatabaseUrl,
});
const prisma = new PrismaClient({ adapter });

async function seedStaff() {
  const availabilityStartDate = toDateOnly(SAMPLE_RANGE.startDate);
  const availabilityEndDate = toDateOnly(SAMPLE_RANGE.endDate);

  await prisma.staffMember.upsert({
    where: { id: SAMPLE_JANE_ID },
    update: { name: "Jane Smith", availabilityStartDate, availabilityEndDate },
    create: {
      id: SAMPLE_JANE_ID,
      name: "Jane Smith",
      availabilityStartDate,
      availabilityEndDate,
    },
  });

  await prisma.staffMember.upsert({
    where: { id: SAMPLE_ALEX_ID },
    update: {
      name: "Alex Rivera",
      availabilityStartDate: null,
      availabilityEndDate: null,
    },
    create: { id: SAMPLE_ALEX_ID, name: "Alex Rivera" },
  });
}

async function seedSampleAvailability() {
  await prisma.$transaction(async (tx) => {
    await tx.weeklyAvailabilityWindow.deleteMany({
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

    await tx.dateOverride.deleteMany({
      where: { staffId: { in: [SAMPLE_JANE_ID, SAMPLE_ALEX_ID] } },
    });

    for (const override of SAMPLE_JANE_OVERRIDES) {
      await tx.dateOverride.create({
        data: {
          staffId: SAMPLE_JANE_ID,
          overrideDate: toDateOnly(override.overrideDate),
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
  });
}

async function main() {
  await seedStaff();
  await seedSampleAvailability();
}

function toDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
