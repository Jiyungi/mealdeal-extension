// Scrubs and de-duplicates warning lists from the Actor.
//
// The Actor sometimes attaches informational strings (e.g. "user-visible
// snapshot supplied; live scraping skipped") that describe internal
// behavior rather than anything the user needs to act on. We strip those.

const INFO_NOT_USER_FACING: RegExp[] = [
  /user-visible snapshot supplied/i,
  /live scraping skipped/i,
  /no live scrape performed/i,
];

export function filterUserFacingWarnings(
  warnings: readonly string[] | null | undefined,
): string[] {
  if (!warnings || warnings.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of warnings) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (INFO_NOT_USER_FACING.some((re) => re.test(trimmed))) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
