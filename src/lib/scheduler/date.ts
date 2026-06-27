import { SchedulerValidationError } from "./windows";
import type { LocalDateString, Weekday } from "./types";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface ParsedLocalDate {
  year: number;
  month: number;
  day: number;
}

export function eachLocalDateInRange(
  startDate: LocalDateString,
  endDate: LocalDateString,
): LocalDateString[] {
  const startDay = toEpochDay(startDate, "startDate");
  const endDay = toEpochDay(endDate, "endDate");

  if (startDay > endDay) {
    throw new SchedulerValidationError("startDate must be before or equal to endDate.");
  }

  const dayCount = endDay - startDay + 1;

  if (dayCount > 366) {
    throw new SchedulerValidationError("Date range cannot be longer than 366 days.");
  }

  return Array.from({ length: dayCount }, (_, index) => formatEpochDay(startDay + index));
}

export function getLocalDateWeekday(date: LocalDateString): Weekday {
  const { year, month, day } = parseLocalDate(date, "date");
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as Weekday;
}

export function assertLocalDate(date: LocalDateString, context: string): void {
  parseLocalDate(date, context);
}

function toEpochDay(date: LocalDateString, context: string): number {
  const { year, month, day } = parseLocalDate(date, context);
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

function formatEpochDay(epochDay: number): LocalDateString {
  return new Date(epochDay * MS_PER_DAY).toISOString().slice(0, 10) as LocalDateString;
}

function parseLocalDate(date: LocalDateString, context: string): ParsedLocalDate {
  const match = DATE_PATTERN.exec(date);

  if (!match) {
    throw new SchedulerValidationError(`${context} must be a YYYY-MM-DD local date.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const roundTrip = new Date(Date.UTC(year, month - 1, day));

  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    throw new SchedulerValidationError(`${context} must be a valid calendar date.`);
  }

  return { year, month, day };
}
