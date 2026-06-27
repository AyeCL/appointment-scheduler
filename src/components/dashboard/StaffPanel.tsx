"use client";

import { CalendarPlus, Plus, UserRound, UsersRound } from "lucide-react";
import { useId, useState } from "react";

import type { StaffMember } from "./types";

type StaffPanelProps = {
  staff: StaffMember[];
  selectedStaffId: string;
  weeklyWindowCount?: number;
  overrideCount?: number;
  onSelectStaff: (staffId: string) => void;
  onCreateStaff: (name: string) => void;
  onLoadSampleSchedule?: () => void;
  isLoadingSampleSchedule?: boolean;
};

export function StaffPanel({
  staff,
  selectedStaffId,
  onSelectStaff,
  onCreateStaff,
  onLoadSampleSchedule,
  isLoadingSampleSchedule = false,
}: StaffPanelProps) {
  const selectId = useId();
  const nameId = useId();
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const hasStaff = staff.length > 0;

  return (
    <section className="border-b border-border px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <UsersRound className="size-4 text-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">Staff & Settings</h2>
      </div>

      {hasStaff ? (
        <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
          <label className="sr-only" htmlFor={selectId}>
            Active staff member
          </label>
          <div className="relative">
            <UserRound
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <select
              id={selectId}
              value={selectedStaffId}
              onChange={(event) => onSelectStaff(event.target.value)}
              className="h-10 w-full appearance-none rounded-md border border-border bg-surface px-9 pr-8 text-sm font-medium outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
            >
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsCreating((current) => !current);
              setNameError(null);
            }}
            className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-accent bg-surface px-3 text-sm font-semibold text-accent transition hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-accent-soft"
          >
            <Plus className="size-4" aria-hidden="true" />
            New Staff
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">No staff yet</p>
            <p className="mt-1 text-sm leading-5 text-muted">
              Create your first staff member, or load a sample schedule to explore the app.
            </p>
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCreating((current) => !current);
                setNameError(null);
              }}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-white transition hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-soft"
            >
              <Plus className="size-4" aria-hidden="true" />
              New Staff
            </button>
            {onLoadSampleSchedule ? (
              <button
                type="button"
                onClick={onLoadSampleSchedule}
                disabled={isLoadingSampleSchedule}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CalendarPlus className="size-4" aria-hidden="true" />
                {isLoadingSampleSchedule ? "Loading..." : "Load Sample Schedule"}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {isCreating ? (
        <form
          noValidate
          className="mt-2"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();

            if (!trimmed) {
              setNameError("Staff name is required.");
              return;
            }

            onCreateStaff(trimmed);
            setName("");
            setNameError(null);
            setIsCreating(false);
          }}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-2">
            <label htmlFor={nameId} className="sr-only">
              New staff name
            </label>
            <input
              id={nameId}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) {
                  setNameError(null);
                }
              }}
              placeholder="Staff name"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? `${nameId}-error` : undefined}
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
            <button
              type="submit"
              className="inline-flex size-10 items-center justify-center rounded-md bg-accent text-white transition hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-soft"
              aria-label="Create staff member"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
          {nameError ? (
            <p id={`${nameId}-error`} className="mt-2 text-xs font-medium text-danger">
              {nameError}
            </p>
          ) : null}
        </form>
      ) : null}

    </section>
  );
}
