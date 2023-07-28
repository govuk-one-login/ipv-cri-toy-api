export class TimeUnit {
  public static readonly Unit = {
    Seconds: "seconds",
    Minutes: "minutes",
    Hours: "hours",
    Days: "days",
    Months: "months",
    Years: "years",
  };

  public static convert = (unit?: string): number => {
    switch (unit) {
      case TimeUnit.Unit.Seconds:
        return 1000;
      case TimeUnit.Unit.Minutes:
        return 1000 * 60;
      case TimeUnit.Unit.Hours:
        return 1000 * 60 * 60;
      case TimeUnit.Unit.Days:
        return 1000 * 60 * 60 * 24;
      case TimeUnit.Unit.Months:
        return 1000 * 60 * 60 * 24 * 30;
      case TimeUnit.Unit.Years:
        return 1000 * 60 * 60 * 24 * 365;
      default:
        throw new Error(`Unexpected time-to-live unit encountered: ${unit}`);
    }
  };

  public static getValue = (value?: string) => {
    const unitKey = Object.keys(TimeUnit.Unit).find(
      (key) =>
        TimeUnit.Unit[key as keyof typeof TimeUnit.Unit] ===
        value?.toLowerCase()
    );
    if (unitKey) {
      return TimeUnit.Unit[unitKey as keyof typeof TimeUnit.Unit];
    }
    throw new Error(`ttlUnit must be valid: ${value}`);
  };
}
