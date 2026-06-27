"use client";

import { PanelLeftClose, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { cn } from "@/lib/ui";

import type {
  AvailabilityWindow,
  CalendarEditMode,
  DashboardProps,
  DateOverride,
  ExplorerRange,
  OverrideWindow,
  StaffSchedule,
  Weekday,
} from "./types";
import {
  createLocalId,
  generatePreviewResults,
  getDefaultRange,
  getWeekStart,
  normalizeWeeklyWindows,
  toDateString,
  validateAdditiveOverrides,
  validateDateOverrides,
  validateRange,
  validateWeeklyWindows,
} from "./utils";
import { AvailabilityExplorer } from "./AvailabilityExplorer";
import { CalendarGrid } from "./CalendarGrid";
import { OverrideEditor } from "./OverrideEditor";
import { SlotResults } from "./SlotResults";
import { StaffPanel } from "./StaffPanel";
import { WeeklyAvailabilityEditor } from "./WeeklyAvailabilityEditor";

const EMPTY_WEEKLY_WINDOWS: AvailabilityWindow[] = [];
const EMPTY_OVERRIDES: DateOverride[] = [];

type SaveStatus = "saving" | "saved" | "error";
type DashboardSnapshot = {
  schedules: StaffSchedule[];
  activeStaffId: string;
  duration: number;
  range: ExplorerRange;
};

const MAX_HISTORY_ITEMS = 50;

function cloneSnapshot(snapshot: DashboardSnapshot): DashboardSnapshot {
  return structuredClone(snapshot);
}

function snapshotsMatch(left: DashboardSnapshot, right: DashboardSnapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function Dashboard({
  schedules: initialSchedules,
  selectedStaffId,
  initialDuration = 30,
  initialRange,
  callbacks,
  createStaffAction,
  loadSampleScheduleAction,
  saveAvailabilityRangeAction,
  saveWeeklyAvailabilityAction,
  saveDateOverridesAction,
}: DashboardProps) {
  const defaultRange = useMemo(() => initialRange ?? getDefaultRange(), [initialRange]);
  const todayWeekStart = useMemo(() => getWeekStart(toDateString(new Date())), []);
  const initialActiveStaffId = selectedStaffId ?? initialSchedules[0]?.id ?? "";
  const initialActiveSchedule = initialSchedules.find(
    (schedule) => schedule.id === initialActiveStaffId,
  );
  const initialActiveRange = initialActiveSchedule?.availabilityRange ?? defaultRange;
  const [schedules, setSchedules] = useState<StaffSchedule[]>(initialSchedules);
  const [activeStaffId, setActiveStaffId] = useState(initialActiveStaffId);
  const [duration, setDuration] = useState(initialDuration);
  const [range, setRange] = useState<ExplorerRange>(initialActiveRange);
  const [weekStart, setWeekStart] = useState(todayWeekStart);
  const [calendarEditMode, setCalendarEditMode] =
    useState<CalendarEditMode>("recurring");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [isLoadingSampleSchedule, setIsLoadingSampleSchedule] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [undoStack, setUndoStack] = useState<DashboardSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<DashboardSnapshot[]>([]);
  const activeSaveCountRef = useRef(0);
  const autosaveFailedRef = useRef(false);
  const pendingDraftSnapshotRef = useRef<DashboardSnapshot | null>(null);
  const createStaffHandler = createStaffAction ?? callbacks?.onCreateStaff;
  const loadSampleScheduleHandler =
    loadSampleScheduleAction ?? callbacks?.onLoadSampleSchedule;
  const saveAvailabilityRangeHandler =
    saveAvailabilityRangeAction ?? callbacks?.onExplorerRangeChange;
  const saveWeeklyAvailabilityHandler =
    saveWeeklyAvailabilityAction ?? callbacks?.onWeeklyWindowsChange;
  const saveDateOverridesHandler = saveDateOverridesAction ?? callbacks?.onOverridesChange;

  const activeSchedule =
    schedules.find((schedule) => schedule.id === activeStaffId) ?? schedules[0];
  const staff = schedules.map((schedule) => ({
    id: schedule.id,
    name: schedule.name,
    updatedAt: schedule.updatedAt,
  }));
  const weeklyWindows = activeSchedule?.weeklyWindows ?? EMPTY_WEEKLY_WINDOWS;
  const overrides = activeSchedule?.overrides ?? EMPTY_OVERRIDES;
  const results = useMemo(
    () => generatePreviewResults(range, duration, weeklyWindows, overrides),
    [duration, overrides, range, weeklyWindows],
  );

  function createSnapshot(): DashboardSnapshot {
    return cloneSnapshot({
      schedules,
      activeStaffId,
      duration,
      range,
    });
  }

  function restoreSnapshot(snapshot: DashboardSnapshot) {
    const restored = cloneSnapshot(snapshot);

    setSchedules(restored.schedules);
    setActiveStaffId(restored.activeStaffId);
    setDuration(restored.duration);
    setRange(restored.range);
    setSaveError(null);
    setSaveStatus("saved");
    pendingDraftSnapshotRef.current = null;
  }

  function recordHistory(snapshot: DashboardSnapshot) {
    const historyItem = cloneSnapshot(snapshot);

    setUndoStack((current) => {
      const previous = current[current.length - 1];

      if (previous && snapshotsMatch(previous, historyItem)) {
        return current;
      }

      return [...current, historyItem].slice(-MAX_HISTORY_ITEMS);
    });
    setRedoStack([]);
  }

  function beginDraftHistory() {
    pendingDraftSnapshotRef.current ??= createSnapshot();
  }

  function takeHistorySnapshotForCommit() {
    const snapshot = pendingDraftSnapshotRef.current ?? createSnapshot();

    pendingDraftSnapshotRef.current = null;
    return snapshot;
  }

  function updateSchedule(
    staffId: string,
    patch: Partial<
      Pick<StaffSchedule, "availabilityRange" | "weeklyWindows" | "overrides" | "updatedAt">
    >,
  ) {
    setSchedules((current) =>
      current.map((schedule) =>
        schedule.id === staffId
          ? {
              ...schedule,
              ...patch,
            }
          : schedule,
      ),
    );
  }

  function beginAutosave() {
    if (activeSaveCountRef.current === 0) {
      autosaveFailedRef.current = false;
    }

    activeSaveCountRef.current += 1;
    setSaveStatus("saving");
  }

  function finishAutosave() {
    activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1);

    if (activeSaveCountRef.current > 0) {
      return;
    }

    if (autosaveFailedRef.current) {
      setSaveStatus("error");
      return;
    }

    setSaveError(null);
    setSaveStatus("saved");
  }

  function failAutosave(error: unknown, fallbackMessage: string) {
    autosaveFailedRef.current = true;
    setSaveError(error instanceof Error ? error.message : fallbackMessage);
  }

  async function persistWeeklyWindows(staffId: string, nextWindows: AvailabilityWindow[]) {
    beginAutosave();

    try {
      const persistedWeeklyWindows =
        (await saveWeeklyAvailabilityHandler?.(
          staffId,
          nextWindows,
        )) ?? nextWindows;

      updateSchedule(staffId, {
        updatedAt: "Just now",
        weeklyWindows: normalizeWeeklyWindows(persistedWeeklyWindows),
      });
    } catch (error) {
      failAutosave(error, "Could not save weekly availability.");
    } finally {
      finishAutosave();
    }
  }

  async function persistOverrides(staffId: string, nextOverrides: DateOverride[]) {
    beginAutosave();

    try {
      const persistedOverrides =
        (await saveDateOverridesHandler?.(staffId, nextOverrides)) ?? nextOverrides;

      updateSchedule(staffId, {
        updatedAt: "Just now",
        overrides: persistedOverrides,
      });
    } catch (error) {
      failAutosave(error, "Could not save date adjustments.");
    } finally {
      finishAutosave();
    }
  }

  async function persistRange(staffId: string, nextRange: ExplorerRange) {
    beginAutosave();

    try {
      const persistedRange =
        (await saveAvailabilityRangeHandler?.(staffId, nextRange)) ?? nextRange;

      updateSchedule(staffId, {
        updatedAt: "Just now",
        availabilityRange: persistedRange,
      });
    } catch (error) {
      failAutosave(error, "Could not save availability range.");
    } finally {
      finishAutosave();
    }
  }

  function persistRestoredSnapshot(snapshot: DashboardSnapshot) {
    callbacks?.onDurationChange?.(snapshot.duration);

    const restoredSchedule = snapshot.schedules.find(
      (schedule) => schedule.id === snapshot.activeStaffId,
    );

    if (!restoredSchedule) {
      return;
    }

    const restoredRange = restoredSchedule.availabilityRange ?? snapshot.range;
    const validationError =
      validateRange(restoredRange) ??
      validateWeeklyWindows(restoredSchedule.weeklyWindows) ??
      validateDateOverrides(restoredSchedule.overrides, restoredSchedule.weeklyWindows);

    if (validationError) {
      setSaveError(validationError);
      setSaveStatus("error");
      return;
    }

    void persistRange(restoredSchedule.id, restoredRange);
    void persistWeeklyWindows(restoredSchedule.id, restoredSchedule.weeklyWindows);
    void persistOverrides(restoredSchedule.id, restoredSchedule.overrides);
  }

  function undoLastChange() {
    const target = undoStack[undoStack.length - 1];

    if (!target) {
      return;
    }

    const current = createSnapshot();

    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [current, ...stack].slice(0, MAX_HISTORY_ITEMS));
    restoreSnapshot(target);
    persistRestoredSnapshot(target);
  }

  function redoLastChange() {
    const target = redoStack[0];

    if (!target) {
      return;
    }

    const current = createSnapshot();

    setRedoStack((stack) => stack.slice(1));
    setUndoStack((stack) => [...stack, current].slice(-MAX_HISTORY_ITEMS));
    restoreSnapshot(target);
    persistRestoredSnapshot(target);
  }

  function updateWeeklyWindowsDraft(nextWindows: AvailabilityWindow[]) {
    if (!activeSchedule) {
      return;
    }

    beginDraftHistory();

    const normalized = normalizeWeeklyWindows(nextWindows);

    updateSchedule(activeStaffId, {
      weeklyWindows: normalized,
    });
  }

  function commitWeeklyWindows(nextWindows: AvailabilityWindow[]) {
    if (!activeSchedule) {
      return;
    }

    const beforeChange = takeHistorySnapshotForCommit();
    const normalized = normalizeWeeklyWindows(nextWindows);
    const validationError =
      validateWeeklyWindows(normalized) ?? validateAdditiveOverrides(overrides, normalized);

    recordHistory(beforeChange);
    updateSchedule(activeStaffId, {
      weeklyWindows: normalized,
    });

    if (validationError) {
      setSaveError(validationError);
      setSaveStatus("error");
      return;
    }

    setSaveError(null);
    void persistWeeklyWindows(activeStaffId, normalized);
  }

  function updateOverridesDraft(nextOverrides: DateOverride[], recordDraft = true) {
    if (!activeSchedule) {
      return false;
    }

    if (recordDraft) {
      beginDraftHistory();
    }

    const validationError = validateDateOverrides(nextOverrides, weeklyWindows);

    if (validationError) {
      setSaveError(validationError);
      setSaveStatus("error");
      return false;
    }

    updateSchedule(activeStaffId, {
      overrides: nextOverrides,
    });
    setSaveError(null);
    return true;
  }

  function commitOverrides(nextOverrides: DateOverride[]) {
    if (!activeSchedule) {
      return;
    }

    const beforeChange = takeHistorySnapshotForCommit();

    if (!updateOverridesDraft(nextOverrides, false)) {
      pendingDraftSnapshotRef.current = null;
      return;
    }

    recordHistory(beforeChange);
    void persistOverrides(activeStaffId, nextOverrides);
  }

  function selectStaff(staffId: string) {
    const selectedSchedule = schedules.find((schedule) => schedule.id === staffId);
    const selectedRange = selectedSchedule?.availabilityRange ?? defaultRange;

    setActiveStaffId(staffId);
    setRange(selectedRange);
    callbacks?.onSelectStaff?.(staffId);
  }

  async function createStaff(name: string) {
    beginAutosave();

    try {
      const callbackSchedule = await createStaffHandler?.(name);
      const nextSchedule =
        callbackSchedule ??
        ({
          id: createLocalId("staff"),
          name,
          updatedAt: "Just now",
          weeklyWindows: [],
          overrides: [],
        } satisfies StaffSchedule);

      setSchedules((current) => [...current, nextSchedule]);
      setActiveStaffId(nextSchedule.id);
      setRange(nextSchedule.availabilityRange ?? defaultRange);
      setWeekStart(getWeekStart((nextSchedule.availabilityRange ?? defaultRange).startDate));
      setSaveError(null);
    } catch (error) {
      failAutosave(error, "Could not create staff member.");
    } finally {
      finishAutosave();
    }
  }

  async function loadSampleSchedule() {
    if (!loadSampleScheduleHandler) {
      return;
    }

    beginAutosave();
    setIsLoadingSampleSchedule(true);

    try {
      const loadedSchedules = await loadSampleScheduleHandler();
      const nextSchedules = loadedSchedules ?? schedules;
      const nextActiveSchedule =
        nextSchedules.find((schedule) => schedule.weeklyWindows.length > 0) ??
        nextSchedules[0];
      const nextRange = nextActiveSchedule?.availabilityRange ?? defaultRange;

      setSchedules(nextSchedules);
      setActiveStaffId(nextActiveSchedule?.id ?? "");
      setRange(nextRange);
      setWeekStart(getWeekStart(nextRange.startDate));
      setUndoStack([]);
      setRedoStack([]);
      setSaveError(null);
    } catch (error) {
      failAutosave(error, "Could not load the sample schedule.");
    } finally {
      setIsLoadingSampleSchedule(false);
      finishAutosave();
    }
  }

  function changeDuration(nextDuration: number) {
    recordHistory(createSnapshot());
    setDuration(nextDuration);
    callbacks?.onDurationChange?.(nextDuration);
  }

  function changeRange(nextRange: ExplorerRange) {
    recordHistory(createSnapshot());
    setRange(nextRange);

    if (!activeSchedule) {
      return;
    }

    if (validateRange(nextRange)) {
      return;
    }

    updateSchedule(activeStaffId, {
      availabilityRange: nextRange,
    });
    void persistRange(activeStaffId, nextRange);
  }

  function changeWeekStart(nextWeekStart: string) {
    setWeekStart(nextWeekStart);
  }

  function bulkApplyWeekly(weekdays: Weekday[], window: OverrideWindow) {
    if (!activeSchedule) {
      return;
    }

    const nextWindows = [
      ...weeklyWindows.filter((weeklyWindow) => !weekdays.includes(weeklyWindow.weekday)),
      ...weekdays.map((weekday) => ({
        id: createLocalId("weekly"),
        weekday,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
      })),
    ];

    commitWeeklyWindows(nextWindows);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div
        className={cn(
          "mx-auto grid min-h-screen max-w-[1680px] grid-cols-1 transition-[grid-template-columns] duration-200",
          isSidebarCollapsed ? "lg:grid-cols-1" : "lg:grid-cols-[390px_minmax(0,1fr)]",
        )}
      >
        {!isSidebarCollapsed ? (
          <aside className="border-b border-border bg-background p-3 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
            <div className="flex max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-md border border-border bg-surface shadow-sm">
              <div className="border-b border-border px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-white" aria-hidden="true">
                      <Plus className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-semibold uppercase tracking-normal text-accent">
                        Vironix
                      </p>
                      <p className="truncate text-sm text-muted">Appointment Scheduler</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSidebarCollapsed(true)}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted transition hover:bg-surface-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft"
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftClose className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto">
                <StaffPanel
                  staff={staff}
                  selectedStaffId={activeStaffId}
                  weeklyWindowCount={weeklyWindows.length}
                  overrideCount={overrides.length}
                  onSelectStaff={selectStaff}
                  onCreateStaff={(name) => {
                    void createStaff(name);
                  }}
                  onLoadSampleSchedule={
                    loadSampleScheduleHandler
                      ? () => {
                          void loadSampleSchedule();
                        }
                      : undefined
                  }
                  isLoadingSampleSchedule={isLoadingSampleSchedule}
                />

                {activeSchedule ? (
                  <>
                    <AvailabilityExplorer
                      duration={duration}
                      range={range}
                      onDurationChange={changeDuration}
                      onRangeChange={changeRange}
                    />

                    <WeeklyAvailabilityEditor
                      windows={weeklyWindows}
                      onChange={commitWeeklyWindows}
                      onBulkApply={bulkApplyWeekly}
                    />

                    <OverrideEditor
                      overrides={overrides}
                      weeklyWindows={weeklyWindows}
                      onChange={commitOverrides}
                    />
                  </>
                ) : null}
              </div>

              {saveError ? (
                <div className="border-t border-border bg-surface p-4">
                  <p className="rounded-md border border-danger/25 bg-danger/5 px-3 py-2 text-xs font-medium text-danger">
                    {saveError}
                  </p>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}

        <div className="min-w-0">
          <CalendarGrid
            weekStart={weekStart}
            duration={duration}
            range={range}
            windows={weeklyWindows}
            overrides={overrides}
            editMode={calendarEditMode}
            onWeekStartChange={changeWeekStart}
            onEditModeChange={setCalendarEditMode}
            onWindowsChange={updateWeeklyWindowsDraft}
            onWindowsCommit={commitWeeklyWindows}
            onOverridesChange={updateOverridesDraft}
            onOverridesCommit={commitOverrides}
            saveStatus={saveStatus}
            isSidebarCollapsed={isSidebarCollapsed}
            onExpandSidebar={() => setIsSidebarCollapsed(false)}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={undoLastChange}
            onRedo={redoLastChange}
          />
          <SlotResults results={results} duration={duration} />
        </div>
      </div>
    </main>
  );
}
