import { TimeUnit } from "../../lambdas/common/utils/time-units";

describe("TimeUnit", () => {
  describe("convertTo", () => {
    it.each([
      [TimeUnit.Unit.Seconds, 1000],
      [TimeUnit.Unit.Minutes, 1000 * 60],
      [TimeUnit.Unit.Hours, 1000 * 60 * 60],
      [TimeUnit.Unit.Days, 1000 * 60 * 60 * 24],
      [TimeUnit.Unit.Months, 1000 * 60 * 60 * 24 * 30],
      [TimeUnit.Unit.Years, 1000 * 60 * 60 * 24 * 365],
    ])("should convert %s conversion to %s", (unit, expected) => {
      expect(TimeUnit.convert(unit)).toBe(expected);
    });

    it("should throw an error for an unexpected unit", () => {
      expect(() => TimeUnit.convert("invalid_unit")).toThrowError(
        "Unexpected time-to-live unit encountered: invalid_unit"
      );
    });
  });

  describe("getValue", () => {
    describe("lowercase", () => {
      it.each([
        ["seconds", TimeUnit.Unit.Seconds],
        ["minutes", TimeUnit.Unit.Minutes],
        ["hours", TimeUnit.Unit.Hours],
        ["days", TimeUnit.Unit.Days],
        ["months", TimeUnit.Unit.Months],
        ["years", TimeUnit.Unit.Years],
      ])(
        "should input '%s' and return the unit as '%s'",
        (stringUnitInput, expected) => {
          expect(TimeUnit.getValue(stringUnitInput)).toBe(expected);
        }
      );
    });

    describe("uppercase", () => {
      it.each([
        ["SECONDS", TimeUnit.Unit.Seconds],
        ["MINUTES", TimeUnit.Unit.Minutes],
        ["HOURS", TimeUnit.Unit.Hours],
        ["DAYS", TimeUnit.Unit.Days],
        ["MONTHS", TimeUnit.Unit.Months],
        ["YEARS", TimeUnit.Unit.Years],
      ])(
        "should input '%s' returns the unit as '%s'",
        (stringUnitInput, expected) => {
          expect(TimeUnit.getValue(stringUnitInput)).toBe(expected);
        }
      );
    });

    describe("invalid unit", () => {
      it("should throw an error for an invalid unit", () => {
        expect(() => TimeUnit.getValue("invalid_unit")).toThrowError(
          "ttlUnit must be valid: invalid_unit"
        );
      });
    });
  });
});
