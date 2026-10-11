import { describe, expect, it } from "vitest";
import { shiftFormSchema } from "../shift-form-schema";

const valid = { employeeId: "e1", shiftDate: "2026-10-12", startTime: "09:00", endTime: "17:00", note: "" };
const messages = (values: object) => {
  const result = shiftFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

describe("shiftFormSchema", () => {
  it("accepts a normal shift", () => {
    expect(messages(valid)).toEqual([]);
  });

  it("asks for the missing pieces", () => {
    expect(messages({ ...valid, employeeId: "" })).toEqual(["employeeId: Pick an employee"]);
    expect(messages({ ...valid, shiftDate: "" })).toEqual(["shiftDate: Choose a date"]);
    expect(messages({ ...valid, startTime: "" })).toEqual(["startTime: Enter a start time"]);
    expect(messages({ ...valid, endTime: "" })).toEqual(["endTime: Enter an end time"]);
  });

  it("requires the end after the start", () => {
    expect(messages({ ...valid, startTime: "17:00", endTime: "09:00" })).toEqual(["endTime: The end time must be after the start time"]);
    expect(messages({ ...valid, startTime: "09:00", endTime: "09:00" })).toEqual(["endTime: The end time must be after the start time"]);
  });

  it("limits the note length", () => {
    expect(messages({ ...valid, note: "x".repeat(121) })).toHaveLength(1);
  });
});
