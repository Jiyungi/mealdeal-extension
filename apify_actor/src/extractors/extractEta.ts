export function extractEtaFromText(text: string): string | null {
  const normalized = text.replace(/\u00a0/g, " ");
  const range = normalized.match(/\b\d{1,3}\s*[-–]\s*\d{1,3}\s*min(?:utes)?\b/i);
  if (range) {
    return range[0].replace(/\s+/g, " ");
  }

  const single = normalized.match(/\b\d{1,3}\s*min(?:utes)?\b/i);
  if (single) {
    return single[0].replace(/\s+/g, " ");
  }

  const time = normalized.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i);
  return time ? time[0].replace(/\s+/g, " ") : null;
}
