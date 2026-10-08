import { describe, expect, it } from "vitest";

/** Pure helper mirroring reason aggregation used by publish flow. */
function mergeReasons(
  existing: Array<"NUMBER" | "TITLE" | "IMAGE_HASH"> | undefined,
  reason: "NUMBER" | "TITLE" | "IMAGE_HASH",
) {
  if (!existing) return [reason];
  return existing.includes(reason) ? existing : [...existing, reason];
}

describe("duplicate reason merge", () => {
  it("collects distinct reasons", () => {
    expect(mergeReasons(undefined, "NUMBER")).toEqual(["NUMBER"]);
    expect(mergeReasons(["NUMBER"], "TITLE")).toEqual(["NUMBER", "TITLE"]);
    expect(mergeReasons(["NUMBER", "TITLE"], "TITLE")).toEqual([
      "NUMBER",
      "TITLE",
    ]);
  });
});
