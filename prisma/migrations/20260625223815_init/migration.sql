-- CreateEnum
CREATE TYPE "OverrideMode" AS ENUM ('unavailable', 'replace', 'add');

-- CreateTable
CREATE TABLE "staff_members" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_availability_windows" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "start_minute" SMALLINT NOT NULL,
    "end_minute" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_availability_windows_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "weekly_availability_windows_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6),
    CONSTRAINT "weekly_availability_windows_start_minute_check" CHECK ("start_minute" BETWEEN 0 AND 1439),
    CONSTRAINT "weekly_availability_windows_end_minute_check" CHECK ("end_minute" BETWEEN 1 AND 1440),
    CONSTRAINT "weekly_availability_windows_order_check" CHECK ("start_minute" < "end_minute")
);

-- CreateTable
CREATE TABLE "date_overrides" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "override_date" DATE NOT NULL,
    "mode" "OverrideMode" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "date_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "override_availability_windows" (
    "id" UUID NOT NULL,
    "override_id" UUID NOT NULL,
    "start_minute" SMALLINT NOT NULL,
    "end_minute" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "override_availability_windows_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "override_availability_windows_start_minute_check" CHECK ("start_minute" BETWEEN 0 AND 1439),
    CONSTRAINT "override_availability_windows_end_minute_check" CHECK ("end_minute" BETWEEN 1 AND 1440),
    CONSTRAINT "override_availability_windows_order_check" CHECK ("start_minute" < "end_minute")
);

-- CreateIndex
CREATE INDEX "weekly_availability_windows_staff_id_weekday_idx" ON "weekly_availability_windows"("staff_id", "weekday");

-- CreateIndex
CREATE INDEX "date_overrides_override_date_idx" ON "date_overrides"("override_date");

-- CreateIndex
CREATE UNIQUE INDEX "date_overrides_staff_id_override_date_key" ON "date_overrides"("staff_id", "override_date");

-- CreateIndex
CREATE INDEX "override_availability_windows_override_id_idx" ON "override_availability_windows"("override_id");

-- AddForeignKey
ALTER TABLE "weekly_availability_windows" ADD CONSTRAINT "weekly_availability_windows_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_overrides" ADD CONSTRAINT "date_overrides_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "override_availability_windows" ADD CONSTRAINT "override_availability_windows_override_id_fkey" FOREIGN KEY ("override_id") REFERENCES "date_overrides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
