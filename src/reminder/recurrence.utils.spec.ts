import { ReminderCadence } from './enums/reminder-cadence.enum';
import {
  computeOccurrences,
  computeDerivedFields,
  prepStartDate,
  RecurrenceDefinition,
} from './recurrence.utils';

function makeOnceDef(anchorDate: string): RecurrenceDefinition {
  return {
    cadence: ReminderCadence.ONCE,
    interval: 1,
    anchorDate,
    weekdays: null,
    leadTimeDays: 0,
  };
}

function makeDailyDef(
  anchorDate: string,
  interval = 1,
  leadTimeDays = 0,
): RecurrenceDefinition {
  return {
    cadence: ReminderCadence.DAILY,
    interval,
    anchorDate,
    weekdays: null,
    leadTimeDays,
  };
}

function makeWeeklyDef(
  anchorDate: string,
  weekdays: number[],
  interval = 1,
  leadTimeDays = 0,
): RecurrenceDefinition {
  return {
    cadence: ReminderCadence.WEEKLY,
    interval,
    anchorDate,
    weekdays,
    leadTimeDays,
  };
}

// ---------------------------------------------------------------------------
// computeOccurrences — ONCE
// ---------------------------------------------------------------------------

describe('computeOccurrences — ONCE', () => {
  it('returns [anchorDate] when anchorDate is within the window', () => {
    const def = makeOnceDef('2026-04-03');
    expect(computeOccurrences(def, '2026-04-01', '2026-04-10')).toEqual([
      '2026-04-03',
    ]);
  });

  it('returns [] when anchorDate is before from', () => {
    const def = makeOnceDef('2026-03-25');
    expect(computeOccurrences(def, '2026-04-01', '2026-04-10')).toEqual([]);
  });

  it('returns [] when anchorDate is after to', () => {
    const def = makeOnceDef('2026-04-15');
    expect(computeOccurrences(def, '2026-04-01', '2026-04-10')).toEqual([]);
  });

  it('returns [anchorDate] when anchorDate equals from', () => {
    const def = makeOnceDef('2026-04-01');
    expect(computeOccurrences(def, '2026-04-01', '2026-04-10')).toEqual([
      '2026-04-01',
    ]);
  });

  it('returns [anchorDate] when anchorDate equals to', () => {
    const def = makeOnceDef('2026-04-10');
    expect(computeOccurrences(def, '2026-04-01', '2026-04-10')).toEqual([
      '2026-04-10',
    ]);
  });

  it('ONCE with leadTimeDays: occurrence visible early when window includes prepStart', () => {
    // anchorDate = 2026-04-05, leadTimeDays = 3 → prepStart = 2026-04-02
    // Window starts 2026-04-01 — occurrence itself (04-05) is in window
    const def = { ...makeOnceDef('2026-04-05'), leadTimeDays: 3 };
    expect(computeOccurrences(def, '2026-04-01', '2026-04-10')).toEqual([
      '2026-04-05',
    ]);
  });
});

// ---------------------------------------------------------------------------
// computeOccurrences — DAILY
// ---------------------------------------------------------------------------

describe('computeOccurrences — DAILY interval=1', () => {
  it('returns dates every day within window', () => {
    const def = makeDailyDef('2026-04-01');
    const result = computeOccurrences(def, '2026-04-01', '2026-04-05');
    expect(result).toEqual([
      '2026-04-01',
      '2026-04-02',
      '2026-04-03',
      '2026-04-04',
      '2026-04-05',
    ]);
  });

  it('skips dates before from when anchor is in the past', () => {
    const def = makeDailyDef('2026-03-29');
    const result = computeOccurrences(def, '2026-04-01', '2026-04-03');
    expect(result).toEqual(['2026-04-01', '2026-04-02', '2026-04-03']);
  });

  it('returns [] when anchor is in the future beyond window', () => {
    const def = makeDailyDef('2026-04-15');
    expect(computeOccurrences(def, '2026-04-01', '2026-04-05')).toEqual([]);
  });
});

describe('computeOccurrences — DAILY interval=2', () => {
  it('returns every other day starting from anchor', () => {
    const def = makeDailyDef('2026-04-01', 2);
    const result = computeOccurrences(def, '2026-04-01', '2026-04-08');
    expect(result).toEqual([
      '2026-04-01',
      '2026-04-03',
      '2026-04-05',
      '2026-04-07',
    ]);
  });

  it('aligns correctly when window starts after anchor', () => {
    const def = makeDailyDef('2026-04-01', 2);
    // anchor 04-01, so next is 04-03, 04-05...
    const result = computeOccurrences(def, '2026-04-04', '2026-04-09');
    expect(result).toEqual(['2026-04-05', '2026-04-07', '2026-04-09']);
  });
});

// ---------------------------------------------------------------------------
// computeOccurrences — WEEKLY
// ---------------------------------------------------------------------------

describe('computeOccurrences — WEEKLY interval=1, single weekday', () => {
  it('returns every Friday within window', () => {
    // 2026-04-03 is a Friday (weekday 5)
    const def = makeWeeklyDef('2026-04-03', [5]);
    const result = computeOccurrences(def, '2026-04-01', '2026-04-24');
    expect(result).toEqual(['2026-04-03', '2026-04-10', '2026-04-17', '2026-04-24']);
  });
});

describe('computeOccurrences — WEEKLY interval=2, biweekly Friday', () => {
  it('returns every other Friday', () => {
    // anchor 2026-04-03 is a Friday
    const def = makeWeeklyDef('2026-04-03', [5], 2);
    const result = computeOccurrences(def, '2026-04-01', '2026-05-01');
    expect(result).toEqual(['2026-04-03', '2026-04-17', '2026-05-01']);
  });
});

describe('computeOccurrences — WEEKLY interval=1, multiple weekdays per week', () => {
  it('returns Tuesdays (2) and Fridays (5) every week', () => {
    // anchor 2026-03-31 is a Tuesday (weekday 2)
    const def = makeWeeklyDef('2026-03-31', [2, 5]);
    const result = computeOccurrences(def, '2026-03-31', '2026-04-10');
    expect(result).toEqual([
      '2026-03-31', // Tue
      '2026-04-03', // Fri
      '2026-04-07', // Tue
      '2026-04-10', // Fri
    ]);
  });
});

describe('computeOccurrences — WEEKLY anchor not on listed weekday', () => {
  it('first occurrence lands on next matching weekday after anchor', () => {
    // anchor 2026-04-01 is a Wednesday (weekday 3); listed weekday is Friday (5)
    const def = makeWeeklyDef('2026-04-01', [5]);
    const result = computeOccurrences(def, '2026-04-01', '2026-04-15');
    // First Friday on or after anchor week's Sunday... anchor week Sunday = 2026-03-29
    // 2026-03-29 + 5 = 2026-04-03 (Friday)
    expect(result).toContain('2026-04-03');
    expect(result).toContain('2026-04-10');
  });
});

describe('computeOccurrences — short-circuit at window end', () => {
  it('stops generating once candidate exceeds to', () => {
    const def = makeDailyDef('2026-04-01');
    // Very small window — should not precompute beyond
    const result = computeOccurrences(def, '2026-04-01', '2026-04-02');
    expect(result).toEqual(['2026-04-01', '2026-04-02']);
    expect(result).not.toContain('2026-04-03');
  });
});

describe('computeOccurrences — empty weekdays', () => {
  it('returns [] when weekdays array is empty for WEEKLY', () => {
    const def: RecurrenceDefinition = {
      cadence: ReminderCadence.WEEKLY,
      interval: 1,
      anchorDate: '2026-04-03',
      weekdays: [],
      leadTimeDays: 0,
    };
    expect(computeOccurrences(def, '2026-04-01', '2026-04-30')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// prepStartDate
// ---------------------------------------------------------------------------

describe('prepStartDate', () => {
  it('returns occurrenceDate when leadTimeDays is 0', () => {
    expect(prepStartDate('2026-04-03', 0)).toBe('2026-04-03');
  });

  it('subtracts leadTimeDays to get prep start', () => {
    expect(prepStartDate('2026-04-03', 2)).toBe('2026-04-01');
  });

  it('crosses month boundary correctly', () => {
    expect(prepStartDate('2026-04-01', 3)).toBe('2026-03-29');
  });
});

// ---------------------------------------------------------------------------
// computeDerivedFields
// ---------------------------------------------------------------------------

describe('computeDerivedFields — isInPrepWindow', () => {
  it('is true exactly on prepStartDate', () => {
    // occurrenceDate = 2026-04-05, leadTimeDays = 3 → prepStart = 2026-04-02
    const { isInPrepWindow } = computeDerivedFields('2026-04-05', 3, '2026-04-02');
    expect(isInPrepWindow).toBe(true);
  });

  it('is false one day before prepStartDate', () => {
    const { isInPrepWindow } = computeDerivedFields('2026-04-05', 3, '2026-04-01');
    expect(isInPrepWindow).toBe(false);
  });

  it('is true when today is after prepStartDate', () => {
    const { isInPrepWindow } = computeDerivedFields('2026-04-05', 3, '2026-04-04');
    expect(isInPrepWindow).toBe(true);
  });
});

describe('computeDerivedFields — isOverdue', () => {
  it('is false for future occurrenceDate', () => {
    const { isOverdue } = computeDerivedFields('2026-04-05', 0, '2026-04-03');
    expect(isOverdue).toBe(false);
  });

  it('is false on occurrenceDate itself', () => {
    const { isOverdue } = computeDerivedFields('2026-04-05', 0, '2026-04-05');
    expect(isOverdue).toBe(false);
  });

  it('is true when today is after occurrenceDate', () => {
    const { isOverdue } = computeDerivedFields('2026-04-03', 0, '2026-04-05');
    expect(isOverdue).toBe(true);
  });
});

describe('computeDerivedFields — daysUntilOccurrence', () => {
  it('is positive for future occurrence', () => {
    const { daysUntilOccurrence } = computeDerivedFields('2026-04-05', 0, '2026-04-03');
    expect(daysUntilOccurrence).toBe(2);
  });

  it('is zero on occurrenceDate', () => {
    const { daysUntilOccurrence } = computeDerivedFields('2026-04-05', 0, '2026-04-05');
    expect(daysUntilOccurrence).toBe(0);
  });

  it('is negative for past occurrence', () => {
    const { daysUntilOccurrence } = computeDerivedFields('2026-04-01', 0, '2026-04-05');
    expect(daysUntilOccurrence).toBe(-4);
  });
});
