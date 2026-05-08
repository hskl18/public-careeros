export function formatTimestampInTimeZone(
  value: string | null,
  timeZoneId = "America/Los_Angeles",
  fallback = "not recorded",
) {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timeZoneId,
  }).format(new Date(value));
}

export function formatDateTimeLocalInputInTimeZone(
  value: string | null,
  timeZoneId = "America/Los_Angeles",
) {
  if (!value) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timeZoneId,
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
