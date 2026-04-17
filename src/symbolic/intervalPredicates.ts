import type { PredicateAlgebra } from "./predicateAlgebra";

export interface NumericInterval {
  start: number;
  end: number;
}

export interface IntervalPredicate {
  intervals: NumericInterval[];
}

export interface IntervalDomain {
  min: number;
  max: number;
}

export function createEmptyIntervalPredicate(): IntervalPredicate {
  return { intervals: [] };
}

export function createIntervalPredicate(intervals: NumericInterval[]): IntervalPredicate {
  return {
    intervals: normalizeIntervals(intervals),
  };
}

export function createRangePredicate(start: number, end: number): IntervalPredicate {
  return createIntervalPredicate([{ start, end }]);
}

export function createPointPredicate(point: number): IntervalPredicate {
  return createRangePredicate(point, point);
}

export function createPredicateFromPoints(points: number[]): IntervalPredicate {
  if (points.length === 0) return createEmptyIntervalPredicate();

  const sorted = Array.from(new Set(points)).sort((a, b) => a - b);
  const intervals: NumericInterval[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (current === end + 1) {
      end = current;
      continue;
    }

    intervals.push({ start, end });
    start = current;
    end = current;
  }

  intervals.push({ start, end });
  return createIntervalPredicate(intervals);
}

export function createUniversePredicate(domain: IntervalDomain): IntervalPredicate {
  return createRangePredicate(domain.min, domain.max);
}

export function enumeratePredicatePoints(predicate: IntervalPredicate): number[] {
  const out: number[] = [];

  for (const interval of predicate.intervals) {
    for (let value = interval.start; value <= interval.end; value += 1) {
      out.push(value);
    }
  }

  return out;
}

export function createIntervalAlgebra(domain: IntervalDomain): PredicateAlgebra<IntervalPredicate> {
  void domain;

  return {
    empty: createEmptyIntervalPredicate,
    union: unionIntervalPredicates,
    intersect: intersectIntervalPredicates,
    difference: differenceIntervalPredicates,
    isEmpty: isEmptyIntervalPredicate,
    isSatisfiable: isSatisfiableIntervalPredicate,
    equals: equalsIntervalPredicates,
  };
}

export function unionIntervalPredicates(a: IntervalPredicate, b: IntervalPredicate): IntervalPredicate {
  return createIntervalPredicate([...a.intervals, ...b.intervals]);
}

export function intersectIntervalPredicates(a: IntervalPredicate, b: IntervalPredicate): IntervalPredicate {
  const out: NumericInterval[] = [];
  let i = 0;
  let j = 0;

  while (i < a.intervals.length && j < b.intervals.length) {
    const left = a.intervals[i];
    const right = b.intervals[j];
    const start = Math.max(left.start, right.start);
    const end = Math.min(left.end, right.end);

    if (start <= end) out.push({ start, end });

    if (left.end < right.end) i += 1;
    else j += 1;
  }

  return createIntervalPredicate(out);
}

export function differenceIntervalPredicates(a: IntervalPredicate, b: IntervalPredicate): IntervalPredicate {
  if (a.intervals.length === 0 || b.intervals.length === 0) {
    return createIntervalPredicate(a.intervals);
  }

  const out: NumericInterval[] = [];
  let bIndex = 0;

  for (const interval of a.intervals) {
    let cursor = interval.start;

    while (bIndex < b.intervals.length && b.intervals[bIndex].end < cursor) {
      bIndex += 1;
    }

    let probeIndex = bIndex;
    while (probeIndex < b.intervals.length && b.intervals[probeIndex].start <= interval.end) {
      const blocker = b.intervals[probeIndex];

      if (blocker.start > cursor) {
        out.push({ start: cursor, end: Math.min(interval.end, blocker.start - 1) });
      }

      cursor = Math.max(cursor, blocker.end + 1);
      if (cursor > interval.end) break;
      probeIndex += 1;
    }

    if (cursor <= interval.end) {
      out.push({ start: cursor, end: interval.end });
    }
  }

  return createIntervalPredicate(out);
}

export function isEmptyIntervalPredicate(predicate: IntervalPredicate): boolean {
  return predicate.intervals.length === 0;
}

export function isSatisfiableIntervalPredicate(predicate: IntervalPredicate): boolean {
  return !isEmptyIntervalPredicate(predicate);
}

export function equalsIntervalPredicates(a: IntervalPredicate, b: IntervalPredicate): boolean {
  if (a.intervals.length !== b.intervals.length) return false;

  for (let i = 0; i < a.intervals.length; i += 1) {
    if (a.intervals[i].start !== b.intervals[i].start || a.intervals[i].end !== b.intervals[i].end) {
      return false;
    }
  }

  return true;
}

function normalizeIntervals(intervals: NumericInterval[]): NumericInterval[] {
  const cleaned = intervals
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.start <= interval.end)
    .map((interval) => ({ start: Math.trunc(interval.start), end: Math.trunc(interval.end) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (cleaned.length === 0) return [];

  const merged: NumericInterval[] = [];
  let current = { ...cleaned[0] };

  for (let i = 1; i < cleaned.length; i += 1) {
    const next = cleaned[i];
    if (next.start <= current.end + 1) {
      current.end = Math.max(current.end, next.end);
      continue;
    }

    merged.push(current);
    current = { ...next };
  }

  merged.push(current);
  return merged;
}
