ALTER TABLE "staff_members"
ADD COLUMN "availability_start_date" DATE,
ADD COLUMN "availability_end_date" DATE,
ADD CONSTRAINT "staff_members_availability_range_pair_check"
  CHECK (
    ("availability_start_date" IS NULL AND "availability_end_date" IS NULL)
    OR ("availability_start_date" IS NOT NULL AND "availability_end_date" IS NOT NULL)
  ),
ADD CONSTRAINT "staff_members_availability_range_order_check"
  CHECK (
    "availability_start_date" IS NULL
    OR "availability_start_date" <= "availability_end_date"
  ),
ADD CONSTRAINT "staff_members_availability_range_length_check"
  CHECK (
    "availability_start_date" IS NULL
    OR "availability_end_date" <= "availability_start_date" + INTERVAL '365 days'
  );
