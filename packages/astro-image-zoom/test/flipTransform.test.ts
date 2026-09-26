import { describe, expect, it } from 'vitest';
import { flipTransform, type ThumbnailFit } from '../zoom';

type Box = { left: number; top: number; width: number; height: number };

// Numbers of an inset() clip-path, in px
const insets = (clipPath: string): number[] =>
  [...clipPath.matchAll(/(-?[\d.]+)px/g)].map(([, value]) => Number(value));

// Applies a transform the way the animation does, to see where the zoomed image (`final`) ends up
// on the screen: `whole` is the image once scaled around its center and moved, `visible` the part
// of it the clip-path leaves. The tests check that `visible` lands on what the thumbnail shows
function landing(final: Box, transform: ReturnType<typeof flipTransform>): { whole: Box; visible: Box } {
  const { x, y, scale, clipPath } = transform;
  const [top, right, bottom, left] = insets(clipPath);
  const width = final.width * scale;
  const height = final.height * scale;
  const wholeLeft = final.left + final.width / 2 + x - width / 2;
  const wholeTop = final.top + final.height / 2 + y - height / 2;
  return {
    whole: { left: wholeLeft, top: wholeTop, width, height },
    visible: {
      left: wholeLeft + left * scale,
      top: wholeTop + top * scale,
      width: width - (left + right) * scale,
      height: height - (top + bottom) * scale,
    },
  };
}

function expectBox(actual: Box, expected: Box): void {
  expect(actual.left).toBeCloseTo(expected.left);
  expect(actual.top).toBeCloseTo(expected.top);
  expect(actual.width).toBeCloseTo(expected.width);
  expect(actual.height).toBeCloseTo(expected.height);
}

const fit = (
  objectFit: string,
  naturalWidth: number,
  naturalHeight: number,
  objectPosition = '50% 50%'
): ThumbnailFit => ({ objectFit, objectPosition, naturalWidth, naturalHeight });

describe('flipTransform', () => {
  it('scales and moves an image with the same shape as its thumbnail, without clipping', () => {
    // A 200×100 thumbnail at (100, 50); the zoomed image is 800×400 at (0, 100)
    const transform = flipTransform(
      { left: 100, top: 50, width: 200, height: 100 },
      { left: 0, top: 100, width: 800, height: 400 }
    );

    expect(transform.scale).toBe(0.25);
    // From the center (400, 300) of the image to the center (200, 100) of the thumbnail
    expect(transform.x).toBe(-200);
    expect(transform.y).toBe(-200);
    expect(insets(transform.clipPath)).toEqual([0, 0, 0, 0]);
  });

  it('covers a square thumbnail with a landscape image, clipping its sides', () => {
    // A 100×100 thumbnail cropped from an 800×400 image
    const transform = flipTransform(
      { left: 0, top: 0, width: 100, height: 100 },
      { left: 0, top: 0, width: 800, height: 400 }
    );

    // Scaled to cover the height: 400 × 0.25 = 100; the width, 200, overflows by 50 on each side
    expect(transform.scale).toBe(0.25);
    const [top, right, bottom, left] = insets(transform.clipPath);
    expect([top, bottom]).toEqual([0, 0]);
    // 50 px of overflow, in the unscaled pixels of the image: 50 / 0.25
    expect([right, left]).toEqual([200, 200]);
  });

  it('covers a wide thumbnail with a portrait image, clipping its top and bottom', () => {
    // A 300×100 thumbnail cropped from a 400×800 image
    const transform = flipTransform(
      { left: 0, top: 0, width: 300, height: 100 },
      { left: 0, top: 0, width: 400, height: 800 }
    );

    // Scaled to cover the width: 400 × 0.75 = 300; the height, 600, overflows by 250 on each side
    expect(transform.scale).toBe(0.75);
    const [top, right, bottom, left] = insets(transform.clipPath);
    expect([right, left]).toEqual([0, 0]);
    expect(top).toBeCloseTo(250 / 0.75);
    expect(bottom).toBeCloseTo(250 / 0.75);
  });

  it('lands the clipped, scaled image exactly on the thumbnail', () => {
    const source = { left: 37, top: 912, width: 240, height: 180 };
    const final = { left: 160, top: 40, width: 960, height: 640 };

    expectBox(landing(final, flipTransform(source, final)).visible, source);
  });

  it('keeps the same transform when the file of the thumbnail has the shape of the image', () => {
    // A 4:3 thumbnail cropped to a square with object-fit: cover, from a 4:3 image
    const source = { left: 10, top: 20, width: 150, height: 150 };
    const final = { left: 0, top: 0, width: 800, height: 600 };

    expect(flipTransform(source, final, fit('cover', 400, 300))).toEqual(flipTransform(source, final));
  });

  it('matches a thumbnail whose file is already cropped to another shape', () => {
    // A portrait image, 400×800 on screen; the thumbnail file is a 4:3 crop of it (as Astro's
    // <Image width height> makes), drawn with object-fit: cover in a 150×200 box
    const source = { left: 0, top: 0, width: 150, height: 200 };
    const final = { left: 0, top: 0, width: 400, height: 800 };
    const { whole, visible } = landing(final, flipTransform(source, final, fit('cover', 640, 480)));

    // The file covers the box at 200 px high, so it is 266.67 px wide; the whole image around it
    // is as wide, and twice as high. Without the fit, it would only be 150 px wide
    expect(whole.width).toBeCloseTo(266.67, 1);
    expect(whole.height).toBeCloseTo(533.33, 1);
    expectBox(visible, source);
  });

  it('shows the whole image, letterboxed, in a thumbnail with object-fit: contain', () => {
    // A 2:1 image in a 200×200 box: drawn 200×100, 50 px from the top
    const source = { left: 0, top: 0, width: 200, height: 200 };
    const final = { left: 0, top: 0, width: 800, height: 400 };
    const transform = flipTransform(source, final, fit('contain', 400, 200));

    expect(insets(transform.clipPath)).toEqual([0, 0, 0, 0]);
    expectBox(landing(final, transform).visible, { left: 0, top: 50, width: 200, height: 100 });
  });

  it('reads an object-position computed as calc(), as keywords with offsets give', () => {
    // "right 10px bottom 20px" computes to calc(100% - 10px) calc(100% - 20px). A 2:1 image
    // covering a 100 px square is 200 × 100: its right edge 10 px inside the box, at 90, puts its left
    // edge at -110; its bottom edge 20 px above the bottom of the box puts its top edge at -20
    const source = { left: 0, top: 0, width: 100, height: 100 };
    const final = { left: 0, top: 0, width: 800, height: 400 };
    const transform = flipTransform(
      source,
      final,
      fit('cover', 200, 100, 'calc(100% - 10px) calc(100% - 20px)')
    );

    expectBox(landing(final, transform).whole, { left: -110, top: -20, width: 200, height: 100 });
  });

  it('animates a thumbnail stretched with object-fit: fill as with cover', () => {
    // A 2:1 file squeezed into a square box: one uniform scale cannot stretch the image back
    const source = { left: 0, top: 0, width: 100, height: 100 };
    const final = { left: 0, top: 0, width: 800, height: 400 };

    expect(flipTransform(source, final, fit('fill', 200, 100))).toEqual(flipTransform(source, final));
  });

  it('fills the box when the file size is unknown', () => {
    // An image that has not loaded, or an SVG without a size: as without a fit
    const source = { left: 0, top: 0, width: 100, height: 100 };
    const final = { left: 0, top: 0, width: 800, height: 400 };

    expect(flipTransform(source, final, fit('contain', 0, 0))).toEqual(flipTransform(source, final));
  });
});
