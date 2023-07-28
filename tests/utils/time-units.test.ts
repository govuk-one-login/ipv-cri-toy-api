import { TimeUnit } from "../../lambdas/common/utils/time-units";

describe("TimeUnit", () => {
  describe("convertTo", () => {
    it("should return the correct conversion for each unit", () => {
      expect(TimeUnit.convert(TimeUnit.Unit.Seconds)).toBe(1000);
      expect(TimeUnit.convert(TimeUnit.Unit.Minutes)).toBe(1000 * 60);
      expect(TimeUnit.convert(TimeUnit.Unit.Hours)).toBe(1000 * 60 * 60);
      expect(TimeUnit.convert(TimeUnit.Unit.Days)).toBe(1000 * 60 * 60 * 24);
    });

    it("should throw an error for an unexpected unit", () => {
      expect(() => TimeUnit.convert("invalid_unit")).toThrowError(
        "Unexpected time-to-live unit encountered: invalid_unit"
      );
    });
  });

  describe("getValue", () => {
    it("should return the correct value for each unit", () => {
      expect(TimeUnit.getValue("seconds")).toBe(TimeUnit.Unit.Seconds);
      expect(TimeUnit.getValue("minutes")).toBe(TimeUnit.Unit.Minutes);
      expect(TimeUnit.getValue("hours")).toBe(TimeUnit.Unit.Hours);
      expect(TimeUnit.getValue("days")).toBe(TimeUnit.Unit.Days);
      expect(TimeUnit.getValue("months")).toBe(TimeUnit.Unit.Months);
      expect(TimeUnit.getValue("years")).toBe(TimeUnit.Unit.Years);
    });

    it("should throw an error for an invalid unit", () => {
      expect(() => TimeUnit.getValue("invalid_unit")).toThrowError(
        "ttlUnit must be valid: invalid_unit"
      );
    });
  });
});
