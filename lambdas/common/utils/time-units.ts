export enum TimeUnit {
  Seconds = "seconds",
  Minutes = "minutes",
  Hours = "hours",
  Days = "days",
}
export function getTimeUnitValue(value?: string): TimeUnit {
  const unitKey = Object.keys(TimeUnit).find(
    (key) => TimeUnit[key as keyof typeof TimeUnit] === value?.toLowerCase()
  );
  if (unitKey) {
    return TimeUnit[unitKey as keyof typeof TimeUnit];
  }
  throw new Error(`Invalid value: ${value}`);
}
