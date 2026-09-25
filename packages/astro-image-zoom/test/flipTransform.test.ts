import { describe, expect, it } from 'vitest';
import { flipTransform } from '../zoom';

// Numbers of an inset() clip-path, in px
const insets = (clipPath: string): number[] =>
  [...clipPath.matchAll(/(-?[\d.]+)px/g)].map(([, value]) => Number(value));

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
    const { x, y, scale, clipPath } = flipTransform(source, final);
    const [top, right, bottom, left] = insets(clipPath);

    // The visible box after clip-path, scale around the center, then translate
    const centerX = final.left + final.width / 2 + x;
    const centerY = final.top + final.height / 2 + y;
    const visibleWidth = (final.width - left - right) * scale;
    const visibleHeight = (final.height - top - bottom) * scale;

    expect(centerX - visibleWidth / 2).toBeCloseTo(source.left);
    expect(centerY - visibleHeight / 2).toBeCloseTo(source.top);
    expect(visibleWidth).toBeCloseTo(source.width);
    expect(visibleHeight).toBeCloseTo(source.height);
  });
});
