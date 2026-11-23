/**
 * The day after a `YYYY-MM-DD` date. Period filters are inclusive of their end day, but the
 * compared columns hold date-times: comparing strictly against the next day keeps the features
 * later on the end day.
 */
export function dayAfter(date: string): string {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}
