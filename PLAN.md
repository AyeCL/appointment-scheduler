# Vironix Appointment Scheduler Plan

## Working Repository

- GitHub repo name: `vironix-appointment-scheduler`
- Visibility: private
- Local database: Postgres
- Later deployment target: Vercel
- Later hosted database: Supabase Postgres

The current workspace is not initialized as a git repo yet. We will create the local app first, then initialize git and create/push the private GitHub repo once the scaffold is real.

Supabase and Vercel are for later, after the local app is working and verified. The schema should stay plain Postgres-compatible so the move from local Postgres to Supabase is mostly an environment/database URL change.

No Docker. Local development should use native Postgres tools, similar to the Youanai setup:

- `psql`
- `createdb`
- `DATABASE_URL`
- `DIRECT_URL`
- Prisma migrations

## Product Summary

Build a small fullstack admin dashboard that lets an admin define staff availability rules and generate available appointment start times.

This is an availability scheduler, not a booking product. It does not create patient appointments, send calendar invites, reserve slots, or sync with Google Calendar.

The core question the app answers:

> Given a staff member, date range, and appointment duration, what appointment start times are available?

## Assignment Requirements

Required:

- Create staff members.
- Configure recurring weekly availability.
- Support multiple availability windows on the same day.
- Configure date-specific overrides.
- Support override modes:
  - unavailable all day
  - replace that day with custom availability windows
  - add extra availability windows for that day
- View availability for a date range.
- Apply appointment duration.
- Support at least 15, 30, 45, and 60 minute durations.
- Prevent or clearly handle invalid windows.
- Show source of availability per date:
  - recurring weekly availability
  - date-specific override
  - no availability
- Persist data across refreshes.
- Include frontend, backend/server actions, persistence, validation, setup instructions, technical decisions, and AI usage notes.

Explicit non-goals:

- Authentication.
- Calendar integrations.
- Pixel-perfect design.

## Design Direction

The PDF does not mandate a UI layout. It only requires a frontend interface and says calendar-style UI is a nice-to-have. That means we can choose the UI.

Proposed direction: Google Calendar-inspired admin dashboard.

Not a clone, but it should borrow the useful interaction model:

- Left configuration panel for staff, duration, weekly availability, and overrides.
- Right calendar/timeline visualization showing the configured windows and generated slots.
- Clear day columns, time grid, source badges, and visual blocks.
- Light-mode, fast, operational feel rather than a marketing page.
- Blue/teal healthcare-ops accents, restrained borders, and dense-but-readable controls.

Primary UI sections:

1. Staff selector and staff creation.
2. Weekly availability editor.
3. Date override editor.
4. Availability explorer.
5. Calendar-style results preview.

Recommended interaction level:

- Full working forms and validation.
- Calendar visualization is functional and data-driven.
- Direct calendar manipulation is part of the target experience:
  - click/drag to create availability windows
  - drag existing windows to move them
  - drag handles to resize start/end times
- Forms remain available as a precise fallback and for accessibility.

## Nice-To-Haves From The PDF

The assignment lists four nice-to-have items. We should strive to complete all four, while still treating the core scheduling logic as the priority.

1. Tests for availability calculation.
2. Seed data.
3. Calendar-style UI.
4. Ability to bulk create weekly availability.

Planned approach:

- Tests: make scheduling logic tests part of the core implementation, not a final polish step.
- Seed data: include a seed command and demo staff that mirror the assignment examples.
- Calendar-style UI: build a Google Calendar-inspired weekly time-grid for visualizing availability windows and generated slots.
- Bulk weekly availability: add a quick-fill control that applies the same availability window to multiple weekdays at once.

## UX Model

### Staff Panel

The admin can:

- Create a staff member.
- Select the active staff member.
- See quick status:
  - weekly windows count
  - upcoming overrides count
  - last updated

### Weekly Availability

The admin can:

- Add one or more windows per weekday.
- Remove windows.
- Mark a weekday as unavailable by leaving it empty.
- See inline validation for bad or overlapping windows.
- Bulk apply one or more windows to selected weekdays.

Example:

- Monday 9:00 AM to 12:00 PM
- Monday 1:00 PM to 5:00 PM
- Wednesday 10:00 AM to 2:00 PM

Bulk create example:

- Select Monday through Friday.
- Enter 9:00 AM to 12:00 PM and 1:00 PM to 5:00 PM.
- Apply to selected days.
- The app replaces the selected weekdays with the new windows by default.
- The app validates the new windows before saving.
- Replacing is the default because it is predictable and avoids accidental overlap stacking.

### Date Overrides

The admin can:

- Choose staff member and date.
- Choose override mode:
  - unavailable
  - replace
  - add
- Add custom windows when mode is `replace` or `add`.
- Add an optional reason/note.

Behavior:

- `unavailable`: no windows for that date.
- `replace`: ignore recurring windows and use override windows only.
- `add`: combine recurring windows with override windows.

### Availability Explorer

The admin can:

- Select staff member.
- Select start date and end date.
- Select appointment duration: 15, 30, 45, or 60 minutes.
- Generate slots.
- Search up to one year at a time.

The results should show:

- Date label.
- Source badge.
- Effective windows.
- Appointment start times.
- Empty/unavailable explanation.
- Monthly grouping for long date ranges.
- Calendar grid focused on the selected week/month so one-year searches do not become visually unusable.

## Technical Architecture

Stack:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui or small local component primitives
- Local Postgres first
- Supabase Postgres later
- Prisma ORM
- Zod validation
- Vitest for scheduling logic tests
- Vercel deployment later

## Local Database Setup

Use native Postgres, not Docker.

Recommended local flow:

1. Ensure Postgres is installed and running.
2. Create a local database:

```bash
createdb vironix_appointment_scheduler
```

3. Create `.env.local`:

```bash
DATABASE_URL=postgresql://$USER@localhost:5432/vironix_appointment_scheduler
DIRECT_URL=postgresql://$USER@localhost:5432/vironix_appointment_scheduler
```

4. Run Prisma migration and seed commands.

Likely scripts:

```bash
npm run db:migrate
npm run db:seed
```

We can add a small setup script that checks for `psql` and `createdb`, creates the database if missing, and refuses to run destructive resets unless the hostname is `localhost`, mirroring the safety idea from Youanai.

Architecture:

```txt
src/app/
  page.tsx
  actions.ts

src/components/
  dashboard/
    StaffPanel.tsx
    WeeklyAvailabilityEditor.tsx
    OverrideEditor.tsx
    AvailabilityExplorer.tsx
    CalendarGrid.tsx
    SlotResults.tsx

src/db/
  client.ts
  queries.ts

src/lib/scheduler/
  types.ts
  windows.ts
  generateSlots.ts
  generateSlots.test.ts

src/lib/validation/
  availabilitySchemas.ts

prisma/
  schema.prisma
  migrations/
  seed.ts
```

Principles:

- Scheduling logic stays pure TypeScript and does not import database code.
- Server actions handle mutations and database reads.
- Backend validation is authoritative.
- Frontend validation is for fast feedback.
- Postgres is accessed through `DATABASE_URL`.
- The initial database is local Postgres.
- The later hosted database is Supabase Postgres.
- Prisma is used for schema, migrations, and typed database access.
- Supabase will be used as a database only. No Supabase Auth, Realtime, Storage, or Edge Functions.

## Data Model

### `staff_members`

```txt
id uuid primary key
name text not null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### `weekly_availability_windows`

```txt
id uuid primary key
staff_id uuid not null references staff_members(id) on delete cascade
weekday smallint not null
start_minute smallint not null
end_minute smallint not null
created_at timestamptz not null default now()
```

Constraints:

- `weekday` between 0 and 6
- `start_minute` between 0 and 1439
- `end_minute` between 1 and 1440
- `start_minute < end_minute`

### `date_overrides`

```txt
id uuid primary key
staff_id uuid not null references staff_members(id) on delete cascade
override_date date not null
mode text not null
reason text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
unique(staff_id, override_date)
```

Allowed `mode` values:

- `unavailable`
- `replace`
- `add`

### `override_availability_windows`

```txt
id uuid primary key
override_id uuid not null references date_overrides(id) on delete cascade
start_minute smallint not null
end_minute smallint not null
created_at timestamptz not null default now()
```

Constraints:

- `start_minute` between 0 and 1439
- `end_minute` between 1 and 1440
- `start_minute < end_minute`

## Scheduling Rules

Assumptions:

- Dates are local calendar dates.
- Date ranges are inclusive.
- Times are stored as minutes since midnight.
- End time is exclusive.
- No overnight windows.
- No booked appointments exist in this project.
- One override can exist per staff member per date.
- Availability searches can cover up to 366 days.

Slot generation:

1. For each date in the inclusive range, determine weekday.
2. Load recurring windows for that weekday.
3. Load date override for that exact staff/date.
4. Determine effective windows:
   - no override: recurring windows
   - `unavailable`: no windows
   - `replace`: override windows
   - `add`: recurring windows plus override windows
5. Validate final windows.
6. Generate start times where `start + duration <= end`.
7. Return results grouped by date with a source label.

Validation:

- Window end must be after start.
- Windows on the same effective day cannot overlap.
- Empty `replace` or `add` override windows are invalid.
- `unavailable` override cannot have windows.
- Duration must be one of 15, 30, 45, or 60 minutes.
- Start date must be before or equal to end date.
- Date range must be 366 days or less.

## API / Server Actions

Likely server actions:

- `createStaff(input)`
- `listStaff()`
- `saveWeeklyAvailability(staffId, windows)`
- `bulkCreateWeeklyAvailability(staffId, weekdays, windows)`
- `upsertDateOverride(staffId, override)`
- `deleteDateOverride(overrideId)`
- `getDashboardData(staffId)`
- `getAvailabilitySlots(input)`

All actions should:

- Validate input with Zod.
- Return typed success/error results.
- Keep database credentials server-side.
- Revalidate the dashboard page after mutations.

## Seed Data

Seed data is optional in the PDF, but worth including for demo quality.

Suggested seed:

- Jane Smith
- Alex Rivera
- Jane recurring:
  - Monday 9:00 AM to 12:00 PM
  - Monday 1:00 PM to 5:00 PM
  - Wednesday 10:00 AM to 2:00 PM
  - Friday 9:00 AM to 11:00 AM
- Jane overrides:
  - 2026-05-27 unavailable
  - 2026-05-28 replace with 10:00 AM to 2:00 PM
  - 2026-05-29 add 5:00 PM to 7:00 PM

This mirrors the assignment examples and makes the demo obvious.

## Testing Plan

Scheduling logic tests:

- Generates 30 minute slots inside one window.
- Generates 45 minute slots and does not exceed window end.
- Handles multiple windows on one day.
- Handles no recurring availability.
- Handles unavailable override.
- Handles replace override.
- Handles add override.
- Rejects overlapping windows.
- Rejects end-before-start windows.
- Rejects empty custom override windows.
- Rejects invalid duration.
- Validates bulk-created weekly windows the same way as manually added windows.

Manual browser checks:

- Create staff.
- Add weekly windows.
- Bulk apply a weekly schedule to multiple weekdays.
- Add unavailable override.
- Add replace override.
- Add extra-hours override.
- Query date range and verify source badges.
- Refresh page and confirm persistence.

## README Plan

README should include:

- What the app does.
- How to run locally.
- Environment variables.
- Local Postgres setup commands.
- Prisma migration and seed commands.
- Local Postgres setup notes.
- Later Supabase setup notes.
- Later Vercel deployment notes.
- Assumptions.
- Scheduling logic explanation.
- Tradeoffs.
- AI usage:
  - tools used
  - what AI helped with
  - what AI suggestion was rejected
  - edge case identified manually
  - least confident code area

## Tradeoffs To Explain

- Chose Postgres instead of SQLite because the app should run locally first and later move cleanly to Supabase Postgres for a Vercel demo.
- Chose Prisma because it matches the local Postgres workflow already used in Youanai and makes migrations/data modeling easy to explain.
- Omitted auth because assignment explicitly says authentication is a non-goal.
- Built an ambitious calendar-style interaction model, but kept scheduling correctness as the priority.
- Did not implement appointment booking or calendar invites because calendar integration and booking workflows are outside scope.
- Kept slot generation in TypeScript rather than SQL so it is easier to test and explain.

## Confirmed Decisions

1. App name:
   - `Vironix Appointment Scheduler`

2. UI editing model:
   - Ambitious calendar editing with drag-to-create, drag-to-move, and drag-to-resize.
   - Form controls remain as a precise fallback.

3. Calendar result view:
   - Use both a weekly/monthly time-grid for visual overview and date-card/month-grouped results for exact generated slots and source labels.

4. Timezone:
   - Fixed Central Time label, documented in README.

5. Date range limits:
   - Support searches up to one year.
   - Calendar visualization focuses on a selected week/month; exact results are grouped for longer ranges.

6. Update/delete support:
   - Support delete/edit for windows and overrides because it makes the admin dashboard believable.

7. Public demo:
   - Assignment says no auth.
   - Public app with no login, documented as assignment-constrained.

8. Bulk weekly availability:
   - Replace selected weekdays by default.
   - No append mode unless core work is finished and it still feels useful.

9. Deployment:
   - Local-first development and verification.
   - Supabase and Vercel setup later.

## Implementation Phases

### Phase 1: Scaffold

Goal:

- Create Next.js app with TypeScript, Tailwind, linting, and test setup.

Verify:

- `npm run dev` works.
- `npm run build` works.

### Phase 2: Database

Goal:

- Add Prisma schema, migrations, local Postgres connection, and seed data.

Verify:

- Migration runs.
- Seed creates example staff/windows/overrides.
- Dashboard can read seeded data.

### Phase 3: Scheduler

Goal:

- Implement pure scheduling engine.

Verify:

- Vitest tests cover core business rules.

### Phase 4: Server Actions

Goal:

- Implement validated backend mutations and availability query.

Verify:

- Actions write/read Postgres and return typed errors.

### Phase 5: Dashboard UI

Goal:

- Build polished light-mode admin dashboard with calendar-inspired layout, direct manipulation, and bulk weekly availability controls.

Verify:

- Full workflow works in browser.
- Calendar drag-create, move, and resize work for weekly windows.
- Bulk weekly availability creates windows for selected weekdays.
- Validation messages are understandable.
- Source of availability is visible per date.

### Phase 6: README And Deployment Prep

Goal:

- Write final README and prepare Supabase/Vercel deployment path.

Verify:

- README covers every assignment requirement.
- Repo is private on GitHub.
- Local app is fully verified before Supabase/Vercel setup.

## Subagent Plan For Implementation

When implementation starts, split work if useful:

- Subagent 1: schema, migrations, seed data, data access.
- Subagent 2: pure scheduling logic and tests.
- Subagent 3: frontend dashboard and UI review.

Main thread integrates, runs verification, fixes issues, and writes README.
