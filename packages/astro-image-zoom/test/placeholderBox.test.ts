import { describe, expect, it } from "vitest";
import { placeholderBox } from "../zoom";

const size = (width: number, height: number) => ({
  naturalWidth: width,
  naturalHeight: height,
});

describe("placeholderBox", () => {
  it("stretches a thumbnail of the whole picture over the image, with no clip", () => {
    const whole = { size: "100% 100%", inset: "0%" };
    expect(placeholderBox(size(400, 300), size(2400, 1800))).toEqual(whole);
    // A rounding of the file sizes is still the whole picture
    expect(placeholderBox(size(401, 300), size(2400, 1800))).toEqual(whole);
  });

  it("puts a crop wider than the image across its middle, clipping the rest", () => {
    // A 3:2 crop of a square picture: all of its width, two thirds of its height
    expect(placeholderBox(size(300, 200), size(2000, 2000))).toEqual({
      size: "100% 66.6667%",
      inset: "16.6667% 0% 16.6667% 0%",
    });
  });

  it("puts a crop narrower than the image down its middle, clipping the rest", () => {
    // A square crop of a 4:3 picture: three quarters of its width, all of its height
    expect(placeholderBox(size(300, 300), size(2400, 1800))).toEqual({
      size: "75% 100%",
      inset: "0% 12.5% 0% 12.5%",
    });
  });

  it("stands in with a crop however little of the picture it shows", () => {
    // A 16:9 strip of a 2:3 portrait: all of its width, 37.5% of its height
    expect(placeholderBox(size(1600, 900), size(1000, 1500))).toEqual({
      size: "100% 37.5%",
      inset: "31.25% 0% 31.25% 0%",
    });
  });

  it("leaves out files without a size", () => {
    expect(placeholderBox(size(0, 0), size(2400, 1800))).toBeNull();
    expect(placeholderBox(size(400, 300), size(0, 0))).toBeNull();
  });
});
