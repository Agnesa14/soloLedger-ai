export function getLocalDateInputValue(base = new Date()) {
  const timezoneOffsetMs = base.getTimezoneOffset() * 60_000;
  return new Date(base.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}
