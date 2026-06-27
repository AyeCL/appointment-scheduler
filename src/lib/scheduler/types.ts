export const APPOINTMENT_DURATIONS = [15, 30, 45, 60] as const;

export type AppointmentDuration = (typeof APPOINTMENT_DURATIONS)[number];

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type LocalDateString = `${number}-${number}-${number}`;

export type OverrideMode = "unavailable" | "replace" | "add";

export type AvailabilityWindowSource = "recurring" | "override";

export type AvailabilitySource =
  | "recurring"
  | "override"
  | "recurring-and-override"
  | "no-availability";

export interface Staff {
  id: string;
  name: string;
}

export interface AvailabilityWindow {
  startMinute: number;
  endMinute: number;
}

export interface WeeklyAvailabilityWindow extends AvailabilityWindow {
  staffId: string;
  weekday: Weekday;
}

export interface DateAvailabilityOverride {
  staffId: string;
  date: LocalDateString;
  mode: OverrideMode;
  windows?: AvailabilityWindow[];
  message?: string;
}

export interface EffectiveAvailabilityWindow extends AvailabilityWindow {
  source: AvailabilityWindowSource;
}

export interface AvailabilitySlot {
  startMinute: number;
  endMinute: number;
  source: AvailabilityWindowSource;
}

export interface DateAvailabilityResult {
  date: LocalDateString;
  weekday: Weekday;
  source: AvailabilitySource;
  sourceLabel: string;
  effectiveWindows: EffectiveAvailabilityWindow[];
  slots: AvailabilitySlot[];
  message?: string;
}

export interface GenerateAvailabilityInput {
  staffId: string;
  startDate: LocalDateString;
  endDate: LocalDateString;
  duration: number;
  weeklyWindows: WeeklyAvailabilityWindow[];
  overrides?: DateAvailabilityOverride[];
}

export interface BuildWeeklyWindowsInput {
  staffId: string;
  weekdays: number[];
  windows: AvailabilityWindow[];
}
