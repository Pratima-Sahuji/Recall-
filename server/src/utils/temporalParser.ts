export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

/**
 * Parses natural language temporal references in a query,
 * respecting user or server timezones.
 */
export function parseTemporalReference(
  query: string,
  referenceDate = new Date(),
  timezoneOffsetMinutes?: number,
): DateRange | null {
  const lower = query.toLowerCase();

  // If timezone offset is provided (e.g. -330 for IST +05:30), compute local date
  let localNow = new Date(referenceDate);
  if (typeof timezoneOffsetMinutes === 'number') {
    const utc = referenceDate.getTime() + referenceDate.getTimezoneOffset() * 60000;
    localNow = new Date(utc - timezoneOffsetMinutes * 60000);
  }

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  // 1. "yesterday"
  if (/\byesterday\b/i.test(lower)) {
    const yesterday = new Date(localNow);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      start: startOfDay(yesterday),
      end: endOfDay(yesterday),
      label: 'yesterday',
    };
  }

  // 2. "today"
  if (/\btoday\b/i.test(lower)) {
    return {
      start: startOfDay(localNow),
      end: endOfDay(localNow),
      label: 'today',
    };
  }

  // 3. "earlier" / "earlier today" / "previously" / "just now"
  if (/\b(earlier|previously|before)\b/i.test(lower)) {
    // Look back up to 24 hours
    const past24h = new Date(localNow.getTime() - 24 * 60 * 60 * 1000);
    return {
      start: past24h,
      end: localNow,
      label: 'earlier',
    };
  }

  // 4. "last week"
  if (/\blast week\b/i.test(lower)) {
    const startOfThisWeek = startOfDay(localNow);
    const dayOfWeek = startOfThisWeek.getDay(); // 0 is Sunday
    const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfThisWeek.setDate(startOfThisWeek.getDate() - distanceToMonday);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    const endOfLastWeek = new Date(startOfThisWeek);
    endOfLastWeek.setMilliseconds(endOfLastWeek.getMilliseconds() - 1);

    return {
      start: startOfLastWeek,
      end: endOfLastWeek,
      label: 'last week',
    };
  }

  // 5. "this week"
  if (/\bthis week\b/i.test(lower)) {
    const startOfThisWeek = startOfDay(localNow);
    const dayOfWeek = startOfThisWeek.getDay();
    const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfThisWeek.setDate(startOfThisWeek.getDate() - distanceToMonday);

    return {
      start: startOfThisWeek,
      end: endOfDay(localNow),
      label: 'this week',
    };
  }

  // 6. "N days ago" (e.g. "2 days ago")
  const daysAgoMatch = lower.match(/\b(\d+)\s+days?\s+ago\b/i);
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10);
    const targetDate = new Date(localNow);
    targetDate.setDate(targetDate.getDate() - days);
    return {
      start: startOfDay(targetDate),
      end: endOfDay(targetDate),
      label: `${days} days ago`,
    };
  }

  // 7. "last month"
  if (/\blast month\b/i.test(lower)) {
    const startOfLastMonth = new Date(localNow.getFullYear(), localNow.getMonth() - 1, 1);
    const endOfLastMonth = new Date(localNow.getFullYear(), localNow.getMonth(), 0, 23, 59, 59, 999);
    return {
      start: startOfLastMonth,
      end: endOfLastMonth,
      label: 'last month',
    };
  }

  return null;
}

