# Vironix Appointment Scheduler

Fullstack staff availability scheduler for recurring weekly hours, date-specific overrides, and generated appointment slots.

## Tech Stack

- Next.js, React, TypeScript
- Prisma
- PostgreSQL
- Vitest

## Setup

Prerequisites:

- Node.js 20+
- npm
- PostgreSQL running locally
- `psql` and `createdb` available in PATH

Install dependencies:

```bash
npm install
```

Create the local database:

```bash
npm run db:setup
```

`db:setup` works best with a local Postgres user matching your OS user. If your local Postgres requires a username/password, create the database manually or set `PGUSER`/`PGPASSWORD` before running the setup command.

Run migrations, generate Prisma client, and seed sample data:

```bash
npm run db:migrate
npm run db:generate
npm run db:seed
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

If local Postgres does not use your OS username, copy `.env.example` to `.env` and set:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/vironix_appointment_scheduler"
```

Sample data is available two ways:

- `npm run db:seed` resets and loads the Jane/Alex sample schedule.
- In an empty database, the app shows a **Load Sample Schedule** button in the staff panel. It only appears before any staff members exist, so it will not overwrite manually entered schedules.

## Scripts

```bash
npm run dev      # local app
npm run test     # unit tests
npm run lint     # lint
npm run build    # production build check
```

## Scheduling Logic

For each date in the selected range:

1. Find recurring weekly windows for that weekday.
2. Apply any date override:
   - `unavailable`: no slots for the date
   - `replace`: use only custom override windows
   - `add`: combine weekly windows with extra windows
3. Validate windows.
4. Generate appointment starts every selected duration where the full appointment fits.

Supported durations: `15`, `30`, `45`, `60` minutes.

## Validation

The app rejects or clearly handles:

- End time before start time
- Overlapping windows on the same day
- Empty custom/add override windows
- Invalid appointment durations
- Date ranges over one year
- Extra hours that overlap weekly hours

Validation runs in the UI and server-side persistence paths.

## Assumptions

- One admin user is already logged in.
- No authentication is needed.
- No calendar integration is needed.
- Availability windows stay within one calendar day.
- Dates are treated as local calendar dates.

## Technical Decisions

- Used a familiar lightweight stack: Next.js, React, TypeScript, Prisma, Postgres, and Vitest.
- Used server actions for writes to keep the fullstack flow simple.
- Used Postgres and Prisma so the data model is explicit and persisted.
- Kept scheduling logic outside the UI in `src/lib/scheduler` so it can be tested directly.
- Used a calendar-style UI because availability is easier to understand visually.
- Added server-side validation so invalid schedules are not only blocked in the browser.

## Tradeoffs

- No auth; the spec says to assume one admin user is logged in.
- No calendar integration; the spec lists it as a non-goal.
- Undo/redo is in-memory and resets on refresh.
- Time zone handling is local/fixed, not configurable.
- Writes replace a staff member's weekly windows or overrides instead of doing granular row updates.
- Drag-and-drop would need more browser coverage in a production app.

## AI Usage

- Tool used:
  - OpenAI Codex

- What I used it for:
  - Planning the app end to end
  - Implementing the Next.js, Prisma, and UI work
  - Writing and updating tests
  - Reviewing the app against the project spec
  - Using browser/computer-use tooling to test UI behavior manually

- AI suggestion I changed or rejected:
  - Early on, SQLite/Drizzle was considered.
  - I chose Postgres/Prisma instead because it matches my usual workflow and keeps the data model explicit.

- Bug, edge case, or design issue I identified:
  - Calendar interactions needed extra care once drag-and-drop, right-click actions, undo/redo, and selection were added.
  - I found and fixed overlap edge cases between weekly hours and date-specific extra hours.
  - I also fixed UI bugs around selecting calendar blocks and creating new windows by dragging.

- Least confident area:
  - Drag-and-drop calendar interactions.
  - They are working well for the project scope, but this is the area I would add more browser-level regression tests for in a production app.
