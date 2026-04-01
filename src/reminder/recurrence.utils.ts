import { ReminderCadence } from './enums/reminder-cadence.enum';

export interface RecurrenceDefinition {
  cadence: ReminderCadence;
  interval: number;
  anchorDate: string;
  weekdays: number[] | null;
  leadTimeDays: number;
}

// ---------------------------------------------------------------------------
// Date helpers (pure, no external deps)
// ---------------------------------------------------------------------------

/** Parse a YYYY-MM-DD string into UTC midnight milliseconds. */
function toMs(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

/** Format milliseconds back to YYYY-MM-DD. */
function toDateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** ISO weekday of a YYYY-MM-DD string, where Sunday=0, Monday=1…Saturday=6. */
function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Return the Monday-start offset (0=Mon … 6=Sun) for a Date's UTC weekday. */
function sundayBasedToMondayBased(day: number): number {
  // No conversion needed — we use Sunday=0 throughout (matching JS getUTCDay)
  return day;
}

// ---------------------------------------------------------------------------
// computeOccurrences
// ---------------------------------------------------------------------------

/**
 * Return sorted YYYY-MM-DD occurrence dates for `definition` within the
 * inclusive window [from, to]. Short-circuits once the candidate exceeds `to`.
 */
export function computeOccurrences(
  definition: RecurrenceDefinition,
  from: string,
  to: string,
): string[] {
  const fromMs = toMs(from);
  const toMs_ = toMs(to);
  const anchorMs = toMs(definition.anchorDate);

  switch (definition.cadence) {
    case ReminderCadence.ONCE: {
      if (anchorMs >= fromMs && anchorMs <= toMs_) {
        return [definition.anchorDate];
      }
      return [];
    }

    case ReminderCadence.DAILY: {
      const results: string[] = [];
      const intervalMs = definition.interval * DAY_MS;

      // Find the first occurrence >= from
      let current = anchorMs;
      if (current < fromMs) {
        const diff = fromMs - current;
        const steps = Math.ceil(diff / intervalMs);
        current = current + steps * intervalMs;
      }

      while (current <= toMs_) {
        results.push(toDateStr(current));
        current += intervalMs;
      }
      return results;
    }

    case ReminderCadence.WEEKLY: {
      const weekdays = definition.weekdays ?? [];
      if (weekdays.length === 0) return [];

      const results: string[] = [];
      const intervalWeeks = definition.interval;

      // Find the Monday of the week containing anchorDate (Sunday = day 0)
      const anchorDow = weekdayOf(definition.anchorDate);
      // Days from Sunday; shift so week starts on Sunday
      // anchorWeekStart = Sunday of the anchor week
      const anchorWeekStartMs = anchorMs - anchorDow * DAY_MS;

      // Current week start (Sunday)
      let weekStartMs = anchorWeekStartMs;

      // If the window starts far in the future, skip ahead
      if (fromMs > anchorMs) {
        const weeksDiff = Math.floor((fromMs - anchorWeekStartMs) / WEEK_MS);
        const alignedWeeks =
          Math.floor(weeksDiff / intervalWeeks) * intervalWeeks;
        weekStartMs = anchorWeekStartMs + alignedWeeks * WEEK_MS;
      }

      // Iterate week-by-week
      outer: while (true) {
        for (const wd of weekdays.slice().sort((a, b) => a - b)) {
          const candidateMs = weekStartMs + wd * DAY_MS;
          if (candidateMs > toMs_) break outer;
          if (candidateMs >= fromMs && candidateMs <= toMs_) {
            results.push(toDateStr(candidateMs));
          }
        }
        weekStartMs += intervalWeeks * WEEK_MS;
      }

      return results;
    }

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// prepStartDate
// ---------------------------------------------------------------------------

/**
 * Returns the date on which prep should start for a given occurrence.
 * Result = occurrenceDate minus leadTimeDays calendar days, as YYYY-MM-DD.
 */
export function prepStartDate(
  occurrenceDate: string,
  leadTimeDays: number,
): string {
  const ms = toMs(occurrenceDate) - leadTimeDays * DAY_MS;
  return toDateStr(ms);
}

// ---------------------------------------------------------------------------
// computeDerivedFields
// ---------------------------------------------------------------------------

export interface DerivedFields {
  isInPrepWindow: boolean;
  isOverdue: boolean;
  daysUntilOccurrence: number;
}

/**
 * Compute derived display fields for an occurrence relative to today.
 *
 * @param occurrenceDate  YYYY-MM-DD occurrence date
 * @param leadTimeDays    Lead time for this reminder
 * @param today           YYYY-MM-DD — the current server date
 */
export function computeDerivedFields(
  occurrenceDate: string,
  leadTimeDays: number,
  today: string,
): DerivedFields {
  const prep = prepStartDate(occurrenceDate, leadTimeDays);
  const todayMs = toMs(today);
  const occMs = toMs(occurrenceDate);
  const prepMs = toMs(prep);

  const isInPrepWindow = todayMs >= prepMs;
  const isOverdue = todayMs > occMs;
  const daysUntilOccurrence = Math.round((occMs - todayMs) / DAY_MS);

  return { isInPrepWindow, isOverdue, daysUntilOccurrence };
}
