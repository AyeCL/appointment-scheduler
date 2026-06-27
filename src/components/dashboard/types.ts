export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type AvailabilitySource =
  | "recurring"
  | "override-replace"
  | "override-add"
  | "unavailable";

export type SlotResultSource =
  | AvailabilitySource
  | "unavailable-override"
  | "no-availability";

export type OverrideMode = "unavailable" | "replace" | "add";

export type CalendarEditMode =
  | "recurring"
  | "override-replace"
  | "override-add"
  | "unavailable";

export type StaffMember = {
  id: string;
  name: string;
  updatedAt?: string;
};

export type AvailabilityWindow = {
  id: string;
  weekday: Weekday;
  startMinute: number;
  endMinute: number;
  source?: AvailabilitySource;
};

export type OverrideWindow = {
  id: string;
  startMinute: number;
  endMinute: number;
};

export type DateOverride = {
  id: string;
  date: string;
  mode: OverrideMode;
  reason?: string;
  windows: OverrideWindow[];
};

export type StaffSchedule = StaffMember & {
  availabilityRange?: ExplorerRange;
  weeklyWindows: AvailabilityWindow[];
  overrides: DateOverride[];
};

export type ExplorerRange = {
  startDate: string;
  endDate: string;
};

export type SlotResult = {
  date: string;
  source: SlotResultSource;
  windows: Array<OverrideWindow & { source: AvailabilitySource }>;
  slots: string[];
  message?: string;
};

export type DashboardCallbacks = {
  onCreateStaff?: (name: string) => StaffSchedule | void | Promise<StaffSchedule | void>;
  onLoadSampleSchedule?: () => StaffSchedule[] | void | Promise<StaffSchedule[] | void>;
  onSelectStaff?: (staffId: string) => void;
  onDurationChange?: (duration: number) => void;
  onExplorerRangeChange?: (
    staffId: string,
    range: ExplorerRange,
  ) => ExplorerRange | void | Promise<ExplorerRange | void>;
  onWeeklyWindowsChange?: (
    staffId: string,
    windows: AvailabilityWindow[],
  ) => AvailabilityWindow[] | void | Promise<AvailabilityWindow[] | void>;
  onBulkWeeklyApply?: (
    staffId: string,
    weekdays: Weekday[],
    window: OverrideWindow,
  ) => AvailabilityWindow[] | void | Promise<AvailabilityWindow[] | void>;
  onOverridesChange?: (
    staffId: string,
    overrides: DateOverride[],
  ) => DateOverride[] | void | Promise<DateOverride[] | void>;
};

export type DashboardProps = {
  schedules: StaffSchedule[];
  selectedStaffId?: string;
  initialDuration?: number;
  initialRange?: ExplorerRange;
  callbacks?: DashboardCallbacks;
  createStaffAction?: DashboardCallbacks["onCreateStaff"];
  loadSampleScheduleAction?: DashboardCallbacks["onLoadSampleSchedule"];
  saveAvailabilityRangeAction?: DashboardCallbacks["onExplorerRangeChange"];
  saveWeeklyAvailabilityAction?: DashboardCallbacks["onWeeklyWindowsChange"];
  saveDateOverridesAction?: DashboardCallbacks["onOverridesChange"];
};
