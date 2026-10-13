import { describe, expect, it } from "vitest";
import { fitWidth } from "../zoom";

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
