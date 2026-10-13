import { describe, expect, it } from "vitest";
import { fitWidth, isFlatClip } from "../zoom";

describe("fitWidth", () => {
  const landscape = { width: 2000, height: 1000 };

  it("fits the picture in the room it has, keeping its shape", () => {
    expect(fitWidth(landscape, { width: 1000, height: 800 })).toBe(1000);
    expect(fitWidth(landscape, { width: 1000, height: 300 })).toBe(600);
  });

  it("does not grow a file past its own size", () => {
    expect(fitWidth(landscape, { width: 4000, height: 3000 })).toBe(2000);
  });
});

describe("isFlatClip", () => {
  it("is flat when nothing is clipped, with or without corners", () => {
    expect(isFlatClip("none")).toBe(true);
    expect(isFlatClip("inset(0px)")).toBe(true);
    expect(isFlatClip("inset(0px 0px 0px 0px round 0px)")).toBe(true);
    expect(isFlatClip("inset(0.2px 0px 0px 0px)")).toBe(true);
  });

  it("is not when it crops or rounds", () => {
    expect(isFlatClip("inset(12px 0px 12px 0px)")).toBe(false);
    expect(isFlatClip("inset(0px round 8px)")).toBe(false);
    expect(isFlatClip("inset(10% 0% 10% 0%)")).toBe(false);
  });
});
