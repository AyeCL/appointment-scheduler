"use client";

import {
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
  Move,
  PanelLeftOpen,
  Redo2,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/ui";

import type {
  AvailabilitySource,
  AvailabilityWindow,
  CalendarEditMode,
  DateOverride,
  ExplorerRange,
  OverrideMode,
  OverrideWindow,
  Weekday,
} from "./types";
import {
  DAY_OPTIONS,
  GRID_END_MINUTE,
  GRID_START_MINUTE,
  GRID_STEP_MINUTES,
  addDays,
  clamp,
  createLocalId,
  formatCompactMinute,
  formatDateLabel,
  formatMinute,
  getWeekDates,
  getWeekStart,
  isDateWithinRange,
  minuteToTimeInput,
  parseDateString,
  snapMinute,
  sourceLabel,
  sortWindows,
  validateAdditiveOverrides,
  validateDateOverrides,
  validateWeeklyWindows,
} from "./utils";

type CalendarGridProps = {
  weekStart: string;
  duration: number;
  range: ExplorerRange;
  windows: AvailabilityWindow[];
  overrides: DateOverride[];
  editMode: CalendarEditMode;
  onWeekStartChange: (weekStart: string) => void;
  onEditModeChange: (editMode: CalendarEditMode) => void;
  onWindowsChange: (windows: AvailabilityWindow[]) => void;
  onWindowsCommit?: (windows: AvailabilityWindow[]) => void;
  onOverridesChange: (overrides: DateOverride[]) => void;
  onOverridesCommit?: (overrides: DateOverride[]) => void;
  saveStatus: "saving" | "saved" | "error";
  isSidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

type DragMode = "create" | "move" | "resize-start" | "resize-end";
type DragScope = "weekly" | "override";

type CalendarBlock = {
  id: string;
  kind: "weekly" | "override" | "unavailable";
  date: string;
  weekday: Weekday;
  startMinute: number;
  endMinute: number;
  source: AvailabilitySource;
  overrideMode?: Extract<OverrideMode, "replace" | "add">;
};

type DragState = {
  mode: DragMode;
  scope: DragScope;
  windowId?: string;
  overrideMode?: Extract<OverrideMode, "replace" | "add">;
  anchorDate: string;
  anchorWeekday: Weekday;
  anchorMinute: number;
  pointerOffsetMinute: number;
  originDate: string;
  originStart: number;
  originEnd: number;
  originWeekday: Weekday;
};

type PendingDragState = DragState & {
  startClientX: number;
  startClientY: number;
};

type BlockContextMenuState = {
  x: number;
  y: number;
  kind: "block";
  block: CalendarBlock;
};

type SpaceContextMenuState = {
  x: number;
  y: number;
  kind: "space";
  date: string;
  weekday: Weekday;
  startMinute: number;
};

type ContextMenuState = BlockContextMenuState | SpaceContextMenuState;

const gridMinutes = GRID_END_MINUTE - GRID_START_MINUTE;
const timeMarks = Array.from({ length: (GRID_END_MINUTE - GRID_START_MINUTE) / 60 + 1 }, (_, index) => {
  return GRID_START_MINUTE + index * 60;
});

const sourceStyles: Record<AvailabilitySource, string> = {
  recurring: "border-accent/35 bg-accent-soft text-accent-strong",
  "override-replace": "border-violet/30 bg-violet/10 text-violet",
  "override-add": "border-teal/30 bg-teal/10 text-teal",
  unavailable: "border-danger/25 bg-danger/10 text-danger",
};

const selectedSourceStyles: Record<AvailabilitySource, string> = {
  recurring: "border-accent bg-accent/25 text-accent-strong ring-2 ring-accent/35",
  "override-replace": "border-violet bg-violet/20 text-violet ring-2 ring-violet/35",
  "override-add": "border-teal bg-teal/20 text-teal ring-2 ring-teal/35",
  unavailable: "border-danger bg-danger/20 text-danger ring-2 ring-danger/30",
};

const EDIT_MODE_OPTIONS: Array<{
  mode: CalendarEditMode;
  label: string;
  source: AvailabilitySource;
  description: string;
}> = [
  {
    mode: "recurring",
    label: "Weekly Hours",
    source: "recurring",
    description: "Create or edit the staff member's normal repeating weekly availability.",
  },
  {
    mode: "override-replace",
    label: "Custom Hours",
    source: "override-replace",
    description: "For one date, ignore the weekly hours and use only the windows you draw.",
  },
  {
    mode: "override-add",
    label: "Extra Hours",
    source: "override-add",
    description: "For one date, keep the weekly hours and add the windows you draw.",
  },
  {
    mode: "unavailable",
    label: "Mark Unavailable",
    source: "unavailable",
    description: "Click a date to mark the staff member unavailable for the whole day.",
  },
];

const calendarBodyHeightClass = "h-[calc(100vh-220px)] min-h-[560px]";

function getBlockKey(block: CalendarBlock) {
  return `${block.kind}:${block.date}:${block.id}`;
}

function getBlockKeyFromParts(kind: CalendarBlock["kind"], date: string, id: string) {
  return `${kind}:${date}:${id}`;
}

function hasWeeklyWindowOverlap(windows: AvailabilityWindow[], overrides: DateOverride[]) {
  return Boolean(validateWeeklyWindows(windows) ?? validateAdditiveOverrides(overrides, windows));
}

function getDefaultContextWindow(startMinute: number) {
  const clampedStart = clamp(
    startMinute,
    GRID_START_MINUTE,
    GRID_END_MINUTE - GRID_STEP_MINUTES,
  );

  return {
    startMinute: clampedStart,
    endMinute: clamp(
      clampedStart + 60,
      clampedStart + GRID_STEP_MINUTES,
      GRID_END_MINUTE,
    ),
  };
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function CalendarGrid({
  weekStart,
  duration,
  range,
  windows,
  overrides,
  editMode,
  onWeekStartChange,
  onEditModeChange,
  onWindowsChange,
  onWindowsCommit,
  onOverridesChange,
  onOverridesCommit,
  saveStatus,
  isSidebarCollapsed,
  onExpandSidebar,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: CalendarGridProps) {
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [pendingDragState, setPendingDragState] = useState<PendingDragState | null>(null);
  const [selectedBlockKey, setSelectedBlockKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [hoveredUnavailableDate, setHoveredUnavailableDate] = useState<string | null>(null);
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const today = useMemo(() => new Date(), []);
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isDateInSelectedRange = useCallback(
    (date: string) => isDateWithinRange(date, range),
    [range],
  );

  const overridesByDate = useMemo(() => {
    return new Map(overrides.map((override) => [override.date, override]));
  }, [overrides]);

  const visibleBlocks = useMemo<CalendarBlock[]>(() => {
    return DAY_OPTIONS.flatMap((day) => {
      const dayIndex = DAY_OPTIONS.findIndex(
        (candidate) => candidate.weekday === day.weekday,
      );
      const date = weekDates[dayIndex];

      if (!isDateInSelectedRange(date)) {
        return [];
      }

      const override = overridesByDate.get(date);
      const recurringBlocks: CalendarBlock[] = windows
        .filter((window) => window.weekday === day.weekday)
        .map((window) => ({
          ...window,
          kind: "weekly" as const,
          source: "recurring" as const,
          date,
        }));

      if (override?.mode === "unavailable") {
        return [
          {
            id: override.id,
            kind: "unavailable" as const,
            date,
            weekday: day.weekday,
            startMinute: GRID_START_MINUTE,
            endMinute: GRID_END_MINUTE,
            source: "unavailable" as const,
          },
        ];
      }

      if (override?.mode === "replace") {
        return override.windows.map((window) => ({
          ...window,
          kind: "override" as const,
          date,
          weekday: day.weekday,
          source: "override-replace" as const,
          overrideMode: "replace" as const,
        }));
      }

      if (override?.mode === "add") {
        return [
          ...recurringBlocks,
          ...override.windows.map((window) => ({
            ...window,
            kind: "override" as const,
            date,
            weekday: day.weekday,
            source: "override-add" as const,
            overrideMode: "add" as const,
          })),
        ];
      }

      return recurringBlocks;
    });
  }, [isDateInSelectedRange, overridesByDate, weekDates, windows]);

  const visibleBlockKeySet = useMemo(() => {
    return new Set(visibleBlocks.map((block) => getBlockKey(block)));
  }, [visibleBlocks]);
  const activeSelectedBlockKey =
    selectedBlockKey && visibleBlockKeySet.has(selectedBlockKey) ? selectedBlockKey : null;
  const activeSelectedBlock = useMemo(() => {
    if (!activeSelectedBlockKey) {
      return null;
    }

    return visibleBlocks.find((block) => getBlockKey(block) === activeSelectedBlockKey) ?? null;
  }, [activeSelectedBlockKey, visibleBlocks]);
  const activeContextMenu =
    contextMenu?.kind === "block"
      ? visibleBlockKeySet.has(getBlockKey(contextMenu.block))
        ? contextMenu
        : null
      : contextMenu &&
          weekDates.includes(contextMenu.date) &&
          isDateInSelectedRange(contextMenu.date)
        ? contextMenu
        : null;
  const activeHoveredUnavailableDate =
    editMode === "unavailable" ? hoveredUnavailableDate : null;

  const getPointerPosition = useCallback((clientX: number, clientY: number) => {
    const columns = columnsRef.current;

    if (!columns) {
      return null;
    }

    const rect = columns.getBoundingClientRect();
    const clampedX = clamp(clientX - rect.left, 0, rect.width - 1);
    const clampedY = clamp(clientY - rect.top, 0, rect.height);
    const dayIndex = clamp(Math.floor((clampedX / rect.width) * DAY_OPTIONS.length), 0, 6);
    const weekday = DAY_OPTIONS[dayIndex].weekday;
    const minute = clamp(
      snapMinute(GRID_START_MINUTE + (clampedY / rect.height) * gridMinutes),
      GRID_START_MINUTE,
      GRID_END_MINUTE,
    );

    return {
      dayIndex,
      weekday,
      date: weekDates[dayIndex],
      minute,
    };
  }, [weekDates]);

  function closeContextMenu() {
    setContextMenu(null);
  }

  const commitOverrideChange = useCallback((nextOverrides: DateOverride[]) => {
    onOverridesChange(nextOverrides);
    onOverridesCommit?.(nextOverrides);
  }, [onOverridesChange, onOverridesCommit]);

  const updateWeeklyWindowsIfValid = useCallback((nextWindows: AvailabilityWindow[]) => {
    if (hasWeeklyWindowOverlap(nextWindows, overrides)) {
      return false;
    }

    onWindowsChange(nextWindows);
    return true;
  }, [onWindowsChange, overrides]);

  const updateOverridesIfValid = useCallback((nextOverrides: DateOverride[]) => {
    if (validateDateOverrides(nextOverrides, windows)) {
      return false;
    }

    onOverridesChange(nextOverrides);
    return true;
  }, [onOverridesChange, windows]);

  const commitOverridesIfValid = useCallback((nextOverrides: DateOverride[]) => {
    if (!updateOverridesIfValid(nextOverrides)) {
      return false;
    }

    onOverridesCommit?.(nextOverrides);
    return true;
  }, [onOverridesCommit, updateOverridesIfValid]);

  const updateDraggedWindow = useCallback((event: PointerEvent) => {
    if (!dragState) {
      return;
    }

    const position = getPointerPosition(event.clientX, event.clientY);

    if (!position) {
      return;
    }

    if (!isDateInSelectedRange(position.date)) {
      return;
    }

    if (dragState.mode === "create") {
      const startMinute = Math.min(dragState.anchorMinute, position.minute);
      const endMinute = Math.max(dragState.anchorMinute, position.minute);
      const nextWindow = {
        id: dragState.windowId ?? createLocalId("weekly"),
        startMinute,
        endMinute: Math.max(endMinute, startMinute + GRID_STEP_MINUTES),
      };

      if (dragState.scope === "override") {
        if (!dragState.overrideMode) {
          return;
        }

        updateOverridesIfValid(
          upsertOverrideWindow(overrides, dragState.anchorDate, dragState.overrideMode, nextWindow),
        );
        return;
      }

      updateWeeklyWindowsIfValid([
        ...windows.filter((window) => window.id !== dragState.windowId),
        {
          id: nextWindow.id,
          weekday: dragState.anchorWeekday,
          startMinute: nextWindow.startMinute,
          endMinute: nextWindow.endMinute,
        },
      ]);
      return;
    }

    if (!dragState.windowId) {
      return;
    }

    if (dragState.mode === "move") {
      const duration = dragState.originEnd - dragState.originStart;
      const nextStart = clamp(
        position.minute - dragState.pointerOffsetMinute,
        GRID_START_MINUTE,
        GRID_END_MINUTE - duration,
      );
      const nextWindow = {
        id: dragState.windowId,
        startMinute: nextStart,
        endMinute: nextStart + duration,
      };

      if (dragState.scope === "override") {
        if (!dragState.windowId || !dragState.overrideMode) {
          return;
        }

        const withoutOriginWindow =
          dragState.originDate === position.date
            ? overrides
            : removeOverrideWindow(overrides, dragState.originDate, dragState.windowId);

        updateOverridesIfValid(
          upsertOverrideWindow(
            withoutOriginWindow,
            position.date,
            dragState.overrideMode,
            nextWindow,
          ),
        );
        return;
      }

      updateWeeklyWindowsIfValid(
        windows.map((window) =>
          window.id === dragState.windowId
            ? {
                ...window,
                weekday: position.weekday,
                startMinute: nextStart,
                endMinute: nextStart + duration,
              }
            : window,
        ),
      );
      return;
    }

    if (dragState.mode === "resize-start") {
      if (dragState.scope === "override") {
        if (!dragState.windowId || !dragState.overrideMode) {
          return;
        }

        updateOverridesIfValid(
          updateOverrideWindow(
            overrides,
            dragState.originDate,
            dragState.overrideMode,
            dragState.windowId,
            {
              startMinute: clamp(
                position.minute,
                GRID_START_MINUTE,
                dragState.originEnd - GRID_STEP_MINUTES,
              ),
            },
          ),
        );
        return;
      }

      updateWeeklyWindowsIfValid(
        windows.map((window) =>
          window.id === dragState.windowId
            ? {
                ...window,
                startMinute: clamp(
                  position.minute,
                  GRID_START_MINUTE,
                  window.endMinute - GRID_STEP_MINUTES,
                ),
              }
            : window,
        ),
      );
      return;
    }

    if (dragState.scope === "override") {
      if (!dragState.windowId || !dragState.overrideMode) {
        return;
      }

      updateOverridesIfValid(
        updateOverrideWindow(
          overrides,
          dragState.originDate,
          dragState.overrideMode,
          dragState.windowId,
          {
            endMinute: clamp(
              position.minute,
              dragState.originStart + GRID_STEP_MINUTES,
              GRID_END_MINUTE,
            ),
          },
        ),
      );
      return;
    }

    updateWeeklyWindowsIfValid(
      windows.map((window) =>
        window.id === dragState.windowId
          ? {
              ...window,
              endMinute: clamp(
                position.minute,
                window.startMinute + GRID_STEP_MINUTES,
                GRID_END_MINUTE,
              ),
            }
        : window,
      ),
    );
  }, [
    dragState,
    getPointerPosition,
    isDateInSelectedRange,
    overrides,
    updateOverridesIfValid,
    updateWeeklyWindowsIfValid,
    windows,
  ]);

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    function handlePointerMove(event: PointerEvent) {
      event.preventDefault();
      updateDraggedWindow(event);
    }

    const activeDragState = dragState;

    function handlePointerUp() {
      if (activeDragState.scope === "weekly") {
        onWindowsCommit?.(windows);
      } else {
        onOverridesCommit?.(overrides);
      }
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, onOverridesCommit, onWindowsCommit, overrides, updateDraggedWindow, windows]);

  useEffect(() => {
    if (!pendingDragState) {
      return undefined;
    }

    const pending = pendingDragState;

    function handlePointerMove(event: PointerEvent) {
      const deltaX = event.clientX - pending.startClientX;
      const deltaY = event.clientY - pending.startClientY;

      if (Math.hypot(deltaX, deltaY) < 4) {
        return;
      }

      event.preventDefault();
      setPendingDragState(null);
      setSelectedBlockKey(
        getBlockKeyFromParts(
          pending.scope === "override" ? "override" : "weekly",
          pending.anchorDate,
          pending.windowId ?? "",
        ),
      );
      setDragState({
        mode: pending.mode,
        scope: pending.scope,
        windowId: pending.windowId,
        overrideMode: pending.overrideMode,
        anchorDate: pending.anchorDate,
        anchorWeekday: pending.anchorWeekday,
        anchorMinute: pending.anchorMinute,
        pointerOffsetMinute: pending.pointerOffsetMinute,
        originDate: pending.originDate,
        originStart: pending.originStart,
        originEnd: pending.originEnd,
        originWeekday: pending.originWeekday,
      });
    }

    function handlePointerUp() {
      setPendingDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [pendingDragState]);

  useEffect(() => {
    if (!activeContextMenu) {
      return undefined;
    }

    function handleWindowClick() {
      setContextMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContextMenu(null);
        setSelectedBlockKey(null);
      }
    }

    window.addEventListener("click", handleWindowClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", handleWindowClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeContextMenu]);

  useEffect(() => {
    if (!activeSelectedBlock || activeContextMenu) {
      return undefined;
    }

    const selectedBlock = activeSelectedBlock;

    function handleSelectedBlockKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      if (isEditableKeyboardTarget(event.target)) {
        return;
      }

      event.preventDefault();

      if (selectedBlock.kind === "override" || selectedBlock.kind === "unavailable") {
        commitOverrideChange(removeOverrideWindow(overrides, selectedBlock.date, selectedBlock.id));
      } else {
        const nextWindows = windows.filter((candidate) => candidate.id !== selectedBlock.id);

        onWindowsChange(nextWindows);
        onWindowsCommit?.(nextWindows);
      }

      setSelectedBlockKey(null);
      setContextMenu(null);
    }

    window.addEventListener("keydown", handleSelectedBlockKeyDown);

    return () => {
      window.removeEventListener("keydown", handleSelectedBlockKeyDown);
    };
  }, [
    activeContextMenu,
    activeSelectedBlock,
    commitOverrideChange,
    onWindowsChange,
    onWindowsCommit,
    overrides,
    windows,
  ]);

  function startCreate(event: React.PointerEvent<HTMLDivElement>, weekday: Weekday) {
    if (event.button !== 0 || event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    closeContextMenu();

    if (activeSelectedBlockKey) {
      setSelectedBlockKey(null);
      return;
    }

    if (selectedBlockKey) {
      setSelectedBlockKey(null);
    }

    const position = getPointerPosition(event.clientX, event.clientY);

    if (!position) {
      return;
    }

    if (!isDateInSelectedRange(position.date)) {
      return;
    }

    if (editMode === "unavailable") {
      commitOverrideChange(upsertUnavailableOverride(overrides, position.date));
      return;
    }

    const isOverrideMode = editMode === "override-replace" || editMode === "override-add";
    const id = createLocalId(isOverrideMode ? "override-window" : "weekly");
    const startMinute = position.minute;
    const overrideMode =
      editMode === "override-replace"
        ? ("replace" as const)
        : editMode === "override-add"
          ? ("add" as const)
          : undefined;

    if (isOverrideMode && overrideMode) {
      const nextOverrides = upsertOverrideWindow(overrides, position.date, overrideMode, {
        id,
        startMinute,
        endMinute: startMinute + GRID_STEP_MINUTES,
      });

      updateOverridesIfValid(nextOverrides);
    } else {
      const nextWindows = [
        ...windows,
        {
          id,
          weekday,
          startMinute,
          endMinute: startMinute + GRID_STEP_MINUTES,
        },
      ];

      updateWeeklyWindowsIfValid(nextWindows);
    }

    setSelectedBlockKey(getBlockKeyFromParts(isOverrideMode ? "override" : "weekly", position.date, id));

    setDragState({
      mode: "create",
      scope: isOverrideMode ? "override" : "weekly",
      windowId: id,
      overrideMode,
      anchorDate: position.date,
      anchorWeekday: weekday,
      anchorMinute: startMinute,
      pointerOffsetMinute: 0,
      originDate: position.date,
      originStart: startMinute,
      originEnd: startMinute + GRID_STEP_MINUTES,
      originWeekday: weekday,
    });
  }

  function startBlockDrag(
    event: React.PointerEvent<HTMLElement>,
    window: CalendarBlock,
    mode: DragMode,
  ) {
    if (event.button !== 0) {
      return;
    }

    setSelectedBlockKey(getBlockKey(window));
    closeContextMenu();

    if (window.kind === "weekly" && editMode !== "recurring") {
      event.preventDefault();
      event.stopPropagation();

      const position = getPointerPosition(event.clientX, event.clientY);

      if (!position) {
        return;
      }

      if (!isDateInSelectedRange(position.date)) {
        return;
      }

      if (editMode === "unavailable") {
        commitOverrideChange(upsertUnavailableOverride(overrides, position.date));
        return;
      }

      const overrideMode = editMode === "override-replace" ? "replace" : "add";
      const id = createLocalId("override-window");
      const startMinute = position.minute;

      setPendingDragState({
        mode: "create",
        scope: "override",
        windowId: id,
        overrideMode,
        anchorDate: position.date,
        anchorWeekday: position.weekday,
        anchorMinute: startMinute,
        pointerOffsetMinute: 0,
        originDate: position.date,
        originStart: startMinute,
        originEnd: startMinute + GRID_STEP_MINUTES,
        originWeekday: position.weekday,
        startClientX: event.clientX,
        startClientY: event.clientY,
      });

      return;
    }

    if (window.kind === "unavailable") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const position = getPointerPosition(event.clientX, event.clientY);
    const pointerOffsetMinute = position ? position.minute - window.startMinute : 0;

    setPendingDragState({
      mode,
      scope: window.kind === "override" ? "override" : "weekly",
      windowId: window.id,
      overrideMode: window.overrideMode,
      anchorDate: window.date,
      anchorWeekday: window.weekday,
      anchorMinute: window.startMinute,
      pointerOffsetMinute,
      originDate: window.date,
      originStart: window.startMinute,
      originEnd: window.endMinute,
      originWeekday: window.weekday,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
  }

  function openBlockMenu(event: React.MouseEvent<HTMLButtonElement>, block: CalendarBlock) {
    event.preventDefault();
    event.stopPropagation();

    setSelectedBlockKey(getBlockKey(block));
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      kind: "block",
      block,
    });
  }

  function openSpaceMenu(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const position = getPointerPosition(event.clientX, event.clientY);

    if (!position) {
      return;
    }

    if (!isDateInSelectedRange(position.date)) {
      return;
    }

    setSelectedBlockKey(null);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      kind: "space",
      date: position.date,
      weekday: position.weekday,
      startMinute: position.minute,
    });
  }

  function createWeeklyWindowFromSpace(space: SpaceContextMenuState) {
    if (!isDateInSelectedRange(space.date)) {
      return;
    }

    const id = createLocalId("weekly");
    const nextWindow = {
      id,
      weekday: space.weekday,
      ...getDefaultContextWindow(space.startMinute),
    };
    const nextWindows = [...windows, nextWindow];

    if (!updateWeeklyWindowsIfValid(nextWindows)) {
      closeContextMenu();
      return;
    }

    onWindowsCommit?.(nextWindows);
    setSelectedBlockKey(getBlockKeyFromParts("weekly", space.date, id));
    closeContextMenu();
  }

  function createOverrideWindowFromSpace(
    space: SpaceContextMenuState,
    mode: Extract<OverrideMode, "replace" | "add">,
  ) {
    if (!isDateInSelectedRange(space.date)) {
      return;
    }

    const id = createLocalId("override-window");

    if (!commitOverridesIfValid(
      upsertOverrideWindow(overrides, space.date, mode, {
        id,
        ...getDefaultContextWindow(space.startMinute),
      }),
    )) {
      closeContextMenu();
      return;
    }

    setSelectedBlockKey(getBlockKeyFromParts("override", space.date, id));
    closeContextMenu();
  }

  function markSpaceDateUnavailable(space: SpaceContextMenuState) {
    if (!isDateInSelectedRange(space.date)) {
      return;
    }

    commitOverrideChange(upsertUnavailableOverride(overrides, space.date));
    setSelectedBlockKey(null);
    closeContextMenu();
  }

  function clearDateAdjustment(date: string) {
    commitOverrideChange(overrides.filter((override) => override.date !== date));
    setSelectedBlockKey(null);
    closeContextMenu();
  }

  function convertBlockToOverride(block: CalendarBlock, mode: Extract<OverrideMode, "replace" | "add">) {
    if (!commitOverridesIfValid(
      upsertOverrideWindow(overrides, block.date, mode, {
        id: block.kind === "override" ? block.id : createLocalId("override-window"),
        startMinute: block.startMinute,
        endMinute: block.endMinute,
      }),
    )) {
      return;
    }

    setSelectedBlockKey(null);
    closeContextMenu();
  }

  function markBlockDateUnavailable(block: CalendarBlock) {
    commitOverrideChange(upsertUnavailableOverride(overrides, block.date));
    setSelectedBlockKey(null);
    closeContextMenu();
  }

  function deleteBlock(block: CalendarBlock) {
    if (block.kind === "override" || block.kind === "unavailable") {
      commitOverrideChange(removeOverrideWindow(overrides, block.date, block.id));
    } else {
      const nextWindows = windows.filter((candidate) => candidate.id !== block.id);

      onWindowsChange(nextWindows);
      onWindowsCommit?.(nextWindows);
    }

    setSelectedBlockKey(null);
    closeContextMenu();
  }

  function moveWindowByKeyboard(window: CalendarBlock, event: React.KeyboardEvent<HTMLButtonElement>) {
    if (window.kind === "unavailable") {
      if (event.key === "Delete" || event.key === "Backspace") {
        commitOverrideChange(overrides.filter((override) => override.date !== window.date));
        event.preventDefault();
      }

      return;
    }

    const dayIndex = DAY_OPTIONS.findIndex((day) => day.weekday === window.weekday);
    const duration = window.endMinute - window.startMinute;
    let next = window;

    if (event.key === "ArrowUp") {
      next = {
        ...window,
        startMinute: clamp(window.startMinute - GRID_STEP_MINUTES, GRID_START_MINUTE, GRID_END_MINUTE - duration),
        endMinute: clamp(window.endMinute - GRID_STEP_MINUTES, GRID_START_MINUTE + duration, GRID_END_MINUTE),
      };
    } else if (event.key === "ArrowDown") {
      next = {
        ...window,
        startMinute: clamp(window.startMinute + GRID_STEP_MINUTES, GRID_START_MINUTE, GRID_END_MINUTE - duration),
        endMinute: clamp(window.endMinute + GRID_STEP_MINUTES, GRID_START_MINUTE + duration, GRID_END_MINUTE),
      };
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      const nextDayIndex = clamp(dayIndex + delta, 0, 6);
      const nextDate = weekDates[nextDayIndex];

      if (!isDateInSelectedRange(nextDate)) {
        event.preventDefault();
        return;
      }

      const nextDay = DAY_OPTIONS[nextDayIndex];
      next = {
        ...window,
        weekday: nextDay.weekday,
        date: nextDate,
      };
    } else if (event.key === "Delete" || event.key === "Backspace") {
      if (window.kind === "override") {
        commitOverrideChange(removeOverrideWindow(overrides, window.date, window.id));
        event.preventDefault();
        return;
      }

      const nextWindows = windows.filter((candidate) => candidate.id !== window.id);

      onWindowsChange(nextWindows);
      onWindowsCommit?.(nextWindows);
      event.preventDefault();
      return;
    } else {
      return;
    }

    event.preventDefault();

    if (window.kind === "override") {
      if (!window.overrideMode) {
        return;
      }

      const nextWindow = {
        id: window.id,
        startMinute: next.startMinute,
        endMinute: next.endMinute,
      };
      const baseOverrides =
        window.date === next.date
          ? overrides
          : removeOverrideWindow(overrides, window.date, window.id);

      commitOverridesIfValid(
        upsertOverrideWindow(baseOverrides, next.date, window.overrideMode, nextWindow),
      );
      return;
    }

    const nextWindows = windows.map((candidate) => (candidate.id === window.id ? next : candidate));

    if (!updateWeeklyWindowsIfValid(nextWindows)) {
      return;
    }

    onWindowsCommit?.(nextWindows);
  }

  return (
    <section className="min-w-0 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {isSidebarCollapsed ? (
            <button
              type="button"
              onClick={onExpandSidebar}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted transition hover:bg-surface-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Weekly Calendar</h2>
            <p className="text-sm text-muted">
              {formatDateLabel(weekStart)} - {formatDateLabel(addDays(weekStart, 6))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold",
              saveStatus === "saving" && "border-accent/25 bg-accent-soft text-accent-strong",
              saveStatus === "saved" && "border-border bg-surface-muted text-muted",
              saveStatus === "error" && "border-danger/25 bg-danger/10 text-danger",
            )}
            role="status"
            aria-live="polite"
          >
            {saveStatus === "saving"
              ? "Saving..."
              : saveStatus === "error"
                ? "Save failed"
                : "Saved"}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-muted transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-muted"
              aria-label="Undo last change"
            >
              <Undo2 className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-muted transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-muted"
              aria-label="Redo last undone change"
            >
              <Redo2 className="size-4" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onWeekStartChange(addDays(weekStart, -7))}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-muted transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft"
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onWeekStartChange(getWeekStart(todayString))}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-muted transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft"
            aria-label="Current week"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onWeekStartChange(addDays(weekStart, 7))}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-muted transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft"
            aria-label="Next week"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <span className="text-[11px] font-semibold tracking-normal text-muted">
          Edit
        </span>
        {EDIT_MODE_OPTIONS.map((option) => {
          const tooltipId = `calendar-edit-mode-${option.mode}-tooltip`;

          return (
            <div key={option.mode} className="group relative">
              <button
                type="button"
                data-testid={`calendar-edit-mode-${option.mode}`}
                onClick={() => onEditModeChange(option.mode)}
                className={cn(
                  "rounded-full border px-2 py-1 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-accent-soft",
                  editMode === option.mode
                    ? sourceStyles[option.source]
                    : "border-border bg-surface text-muted hover:text-foreground",
                )}
                aria-describedby={tooltipId}
                aria-pressed={editMode === option.mode}
              >
                {option.label}
              </button>
              <span
                id={tooltipId}
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-50 w-64 -translate-x-1/2 rounded-md border border-border bg-foreground px-3 py-2 text-left text-xs font-medium leading-5 text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100"
              >
                {option.description}
              </span>
            </div>
          );
        })}
        <span className="rounded-full border border-border bg-surface-muted px-2 py-1 text-[11px] font-semibold text-muted">
          {duration} min slots
        </span>
      </div>

      <div>
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[72px_1fr] border-b border-border">
            <div className="border-r border-border bg-surface-muted" />
            <div className="grid grid-cols-7">
              {DAY_OPTIONS.map((day, index) => {
                const date = weekDates[index];
                const isInRange = isDateInSelectedRange(date);
                const override = isInRange ? overridesByDate.get(date) : undefined;
                const isToday = date === todayString;

                return (
                  <div
                    key={day.weekday}
                    className={cn(
                      "border-r border-border px-3 py-3 transition-colors last:border-r-0",
                      isInRange ? "bg-surface" : "bg-surface-muted/70 text-muted",
                      editMode === "unavailable" && isInRange && "cursor-pointer",
                      activeHoveredUnavailableDate === date && isInRange && "bg-danger/5",
                    )}
                    aria-disabled={!isInRange}
                    onPointerEnter={() => {
                      if (editMode === "unavailable" && isInRange) {
                        setHoveredUnavailableDate(date);
                      }
                    }}
                    onPointerLeave={() => {
                      if (hoveredUnavailableDate === date) {
                        setHoveredUnavailableDate(null);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-normal text-muted">
                          {day.short}
                        </div>
                        <div
                          className={cn(
                            "mt-1 inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold",
                            isToday && isInRange
                              ? "bg-accent text-white"
                              : isInRange
                                ? "text-foreground"
                                : "text-muted",
                          )}
                        >
                          {parseDateString(date).getDate()}
                        </div>
                      </div>
                      {override ? (
                        <span
                          className={cn(
                            "rounded-full border px-2 py-1 text-[11px] font-semibold",
                            sourceStyles[
                              override.mode === "unavailable"
                                ? "unavailable"
                                : override.mode === "replace"
                                  ? "override-replace"
                                  : "override-add"
                            ],
                          )}
                        >
                          {sourceLabel(
                            override.mode === "unavailable"
                              ? "unavailable"
                              : override.mode === "replace"
                                ? "override-replace"
                                : "override-add",
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-[72px_1fr]">
            <div className={cn("relative border-r border-border bg-surface-muted", calendarBodyHeightClass)}>
              {timeMarks.map((minute) => (
                <div
                  key={minute}
                  className="absolute right-2 -translate-y-2 text-[11px] font-medium text-muted"
                  style={{
                    top: `${((minute - GRID_START_MINUTE) / gridMinutes) * 100}%`,
                  }}
                >
                  {formatCompactMinute(minute)}
                </div>
              ))}
            </div>

            <div ref={columnsRef} className={cn("relative grid select-none grid-cols-7 bg-surface", calendarBodyHeightClass)}>
              {timeMarks.map((minute) => (
                <div
                  key={minute}
                  className="pointer-events-none absolute inset-x-0 border-t border-border/80"
                  style={{
                    top: `${((minute - GRID_START_MINUTE) / gridMinutes) * 100}%`,
                  }}
                />
              ))}

              {DAY_OPTIONS.map((day) => {
                const date = weekDates[DAY_OPTIONS.findIndex((candidate) => candidate.weekday === day.weekday)];
                const isInRange = isDateInSelectedRange(date);

                return (
                  <div
                    key={day.weekday}
                    data-calendar-day={date}
                    className={cn(
                      "relative border-r border-border/80 transition-colors last:border-r-0",
                      isInRange ? "bg-surface" : "bg-surface-muted/50",
                      editMode === "unavailable" && isInRange && "cursor-pointer hover:bg-danger/5",
                      activeHoveredUnavailableDate === date && isInRange && "bg-danger/5",
                    )}
                    aria-disabled={!isInRange}
                    onPointerEnter={() => {
                      if (editMode === "unavailable" && isInRange) {
                        setHoveredUnavailableDate(date);
                      }
                    }}
                    onPointerLeave={() => {
                      if (hoveredUnavailableDate === date) {
                        setHoveredUnavailableDate(null);
                      }
                    }}
                    onPointerDown={(event) => startCreate(event, day.weekday)}
                    onContextMenu={openSpaceMenu}
                  />
                );
              })}

              {visibleBlocks.map((window) => {
                const dayIndex = DAY_OPTIONS.findIndex((day) => day.weekday === window.weekday);
                const blockKey = getBlockKey(window);
                const isSelected = activeSelectedBlockKey === blockKey;
                const top = ((window.startMinute - GRID_START_MINUTE) / gridMinutes) * 100;
                const height = ((window.endMinute - window.startMinute) / gridMinutes) * 100;
                const left = `${(dayIndex / 7) * 100}%`;
                const width = `${100 / 7}%`;

                return (
                  <button
                    key={`${window.kind}-${window.date}-${window.id}`}
                    type="button"
                    data-calendar-block-date={window.date}
                    onPointerDown={(event) => startBlockDrag(event, window, "move")}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedBlockKey(blockKey);
                    }}
                    onPointerEnter={() => {
                      if (editMode === "unavailable") {
                        setHoveredUnavailableDate(window.date);
                      }
                    }}
                    onPointerLeave={() => {
                      if (hoveredUnavailableDate === window.date) {
                        setHoveredUnavailableDate(null);
                      }
                    }}
                    onContextMenu={(event) => openBlockMenu(event, window)}
                    onKeyDown={(event) => moveWindowByKeyboard(window, event)}
                    className={cn(
                      "absolute z-10 overflow-hidden rounded-md border px-2 py-1 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-accent",
                      isSelected ? selectedSourceStyles[window.source] : sourceStyles[window.source],
                      window.kind === "unavailable"
                        ? "flex items-center justify-center border-dashed"
                        : "hover:ring-2 hover:ring-accent-soft",
                    )}
                    style={{
                      top: `${top}%`,
                      height: `${Math.max(height, 3)}%`,
                      left,
                      width,
                    }}
                    aria-pressed={isSelected}
                    aria-label={`${sourceLabel(window.source)} availability ${formatMinute(window.startMinute)} to ${formatMinute(window.endMinute)}`}
                    title={`${minuteToTimeInput(window.startMinute)}-${minuteToTimeInput(window.endMinute)}`}
                  >
                    {window.kind === "unavailable" ? (
                      <span className="text-center text-xs font-semibold">
                        Unavailable
                      </span>
                    ) : (
                      <>
                        <span className="flex items-center gap-1 text-[11px] font-semibold">
                          <Move className="size-3" aria-hidden="true" />
                          {formatCompactMinute(window.startMinute)}-{formatCompactMinute(window.endMinute)}
                        </span>
                        <span className="mt-0.5 block text-[10px] font-medium opacity-75">
                          {sourceLabel(window.source)}
                        </span>
                        <span
                          role="presentation"
                          className="absolute inset-x-1 top-0 flex h-3 cursor-ns-resize items-center justify-center opacity-70"
                          onPointerDown={(event) => startBlockDrag(event, window, "resize-start")}
                        >
                          <GripHorizontal className="size-3" aria-hidden="true" />
                        </span>
                        <span
                          role="presentation"
                          className="absolute inset-x-1 bottom-0 flex h-3 cursor-ns-resize items-center justify-center opacity-70"
                          onPointerDown={(event) => startBlockDrag(event, window, "resize-end")}
                        >
                          <GripHorizontal className="size-3" aria-hidden="true" />
                        </span>
                      </>
                    )}
                  </button>
                );
              })}

              {activeContextMenu ? (
                <div
                  role="menu"
                  className="fixed z-50 w-56 overflow-hidden rounded-md border border-border bg-surface text-sm shadow-lg"
                  style={{
                    left: activeContextMenu.x,
                    top: activeContextMenu.y,
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  {activeContextMenu.kind === "block" ? (
                    <>
                      {activeContextMenu.block.kind !== "unavailable" ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-3 py-2 text-left font-medium text-foreground hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
                          onClick={() => markBlockDateUnavailable(activeContextMenu.block)}
                        >
                          Mark whole day unavailable
                        </button>
                      ) : null}
                      {activeContextMenu.block.kind !== "unavailable" &&
                      activeContextMenu.block.overrideMode !== "replace" ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-3 py-2 text-left text-foreground hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
                          onClick={() => convertBlockToOverride(activeContextMenu.block, "replace")}
                        >
                          Use custom hours for this day
                        </button>
                      ) : null}
                      {activeContextMenu.block.kind === "override" &&
                      activeContextMenu.block.overrideMode !== "add" ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-3 py-2 text-left text-foreground hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
                          onClick={() => convertBlockToOverride(activeContextMenu.block, "add")}
                        >
                          Add as extra hours
                        </button>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full border-t border-border px-3 py-2 text-left text-danger hover:bg-danger/10 focus:bg-danger/10 focus:outline-none"
                        onClick={() => deleteBlock(activeContextMenu.block)}
                      >
                        {activeContextMenu.block.kind === "unavailable" ? "Clear unavailable day" : "Delete window"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-3 py-2 text-left font-medium text-foreground hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
                        onClick={() => createWeeklyWindowFromSpace(activeContextMenu)}
                      >
                        Add weekly hours here
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-3 py-2 text-left text-foreground hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
                        onClick={() => createOverrideWindowFromSpace(activeContextMenu, "replace")}
                      >
                        Use custom hours here
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-3 py-2 text-left text-foreground hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
                        onClick={() => createOverrideWindowFromSpace(activeContextMenu, "add")}
                      >
                        Add extra hours here
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full border-t border-border px-3 py-2 text-left text-danger hover:bg-danger/10 focus:bg-danger/10 focus:outline-none"
                        onClick={() => markSpaceDateUnavailable(activeContextMenu)}
                      >
                        Mark whole day unavailable
                      </button>
                      {overridesByDate.has(activeContextMenu.date) ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full border-t border-border px-3 py-2 text-left text-danger hover:bg-danger/10 focus:bg-danger/10 focus:outline-none"
                          onClick={() => clearDateAdjustment(activeContextMenu.date)}
                        >
                          Clear date adjustment
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function upsertUnavailableOverride(
  overrides: DateOverride[],
  date: string,
): DateOverride[] {
  const existing = overrides.find((override) => override.date === date);
  const nextOverride: DateOverride = {
    id: existing?.id ?? createLocalId("override"),
    date,
    mode: "unavailable",
    reason: existing?.reason,
    windows: [],
  };

  return sortOverrides([
    ...overrides.filter((override) => override.date !== date),
    nextOverride,
  ]);
}

function upsertOverrideWindow(
  overrides: DateOverride[],
  date: string,
  mode: Extract<OverrideMode, "replace" | "add">,
  window: OverrideWindow,
): DateOverride[] {
  const existing = overrides.find((override) => override.date === date);
  const existingWindows =
    existing?.mode === mode
      ? existing.windows.filter((candidate) => candidate.id !== window.id)
      : [];
  const nextOverride: DateOverride = {
    id: existing?.id ?? createLocalId("override"),
    date,
    mode,
    reason: existing?.mode === mode ? existing.reason : undefined,
    windows: sortWindows([...existingWindows, window]),
  };

  return sortOverrides([
    ...overrides.filter((override) => override.date !== date),
    nextOverride,
  ]);
}

function updateOverrideWindow(
  overrides: DateOverride[],
  date: string,
  mode: Extract<OverrideMode, "replace" | "add">,
  windowId: string,
  patch: Partial<OverrideWindow>,
): DateOverride[] {
  const existing = overrides.find((override) => override.date === date);
  const currentWindow = existing?.windows.find((window) => window.id === windowId);

  if (!currentWindow) {
    return overrides;
  }

  return upsertOverrideWindow(overrides, date, mode, {
    ...currentWindow,
    ...patch,
  });
}

function removeOverrideWindow(
  overrides: DateOverride[],
  date: string,
  windowId: string,
): DateOverride[] {
  const existing = overrides.find((override) => override.date === date);

  if (!existing) {
    return overrides;
  }

  if (existing.mode === "unavailable") {
    return overrides.filter((override) => override.date !== date);
  }

  const nextWindows = existing.windows.filter((window) => window.id !== windowId);

  if (nextWindows.length === 0) {
    return overrides.filter((override) => override.date !== date);
  }

  return sortOverrides([
    ...overrides.filter((override) => override.date !== date),
    {
      ...existing,
      windows: nextWindows,
    },
  ]);
}

function sortOverrides(overrides: DateOverride[]) {
  return [...overrides].sort((left, right) => left.date.localeCompare(right.date));
}
