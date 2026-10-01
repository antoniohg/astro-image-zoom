import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import ImageZoom from "../ImageZoom.astro";

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

// Renders the component around some images and returns the attributes of <astro-image-zoom>
async function render(
  props: Record<string, unknown> = {},
  slot = '<img src="/photo.jpg" alt="A photo">',
): Promise<{ html: string; attributes: Map<string, string> }> {
  const html = await container.renderToString(ImageZoom, {
    props,
    slots: { default: slot },
  });
  const tag = /<astro-image-zoom\b([^>]*)>/.exec(html);
  if (!tag) throw new Error(`No <astro-image-zoom> in:\n${html}`);

  const attributes = new Map<string, string>();
  for (const [, name, value] of tag[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
    attributes.set(name, value ?? "");
  }
  return { html, attributes };
}

describe("<ImageZoom>", () => {
  it("renders the defaults as data attributes", async () => {
    const { attributes } = await render();
    expect(Object.fromEntries(attributes)).toMatchObject({
      class: "astro-image-zoom-wrapper",
      "data-image-zoom-close-backdrop": "true",
      "data-image-zoom-close-image": "true",
      "data-image-zoom-close-scroll": "true",
      "data-image-zoom-show-nav": "true",
      "data-image-zoom-navigation-layout": "bar",
      "data-image-zoom-show-counter": "true",
      "data-image-zoom-show-caption": "true",
      "data-image-zoom-caption-position": "bottom",
    });
    // No theme and no duration: the variables of the site apply
    expect(attributes.has("style")).toBe(false);
    expect(attributes.has("data-image-zoom-ignore-selector")).toBe(false);
  });

  it("renders every option as its data attribute", async () => {
    const { attributes } = await render({
      closeOnBackdrop: false,
      closeOnImage: false,
      closeOnScroll: false,
      showNavigation: false,
      navigationLayout: "sides",
      showCounter: false,
      showCaption: false,
      captionPosition: "top",
      class: "portfolio",
    });
    expect(Object.fromEntries(attributes)).toMatchObject({
      class: "astro-image-zoom-wrapper portfolio",
      "data-image-zoom-close-backdrop": "false",
      "data-image-zoom-close-image": "false",
      "data-image-zoom-close-scroll": "false",
      "data-image-zoom-show-nav": "false",
      "data-image-zoom-navigation-layout": "sides",
      "data-image-zoom-show-counter": "false",
      "data-image-zoom-show-caption": "false",
      "data-image-zoom-caption-position": "top",
    });
  });

  it("turns the theme and the duration into --zoom-* variables", async () => {
    const { attributes } = await render({
      theme: {
        backgroundColor: "#050a1a",
        closeButtonColor: "white",
        closeButtonBackground: "black",
        navigationColor: "rgb(1, 2, 3)",
        navigationBackground: "navy",
        captionColor: "red",
        captionBackground: "light-dark(#fff, #000)",
      },
      animationDuration: 800,
    });
    expect(attributes.get("style")).toBe(
      "--zoom-bg: #050a1a; --zoom-close-color: white; --zoom-close-bg: black; " +
        "--zoom-nav-color: rgb(1, 2, 3); --zoom-nav-bg: navy; --zoom-caption-color: red; " +
        "--zoom-caption-bg: light-dark(#fff, #000); --zoom-animation-duration: 800ms",
    );
  });

  it("sets only the variables it is given", async () => {
    expect(
      (await render({ theme: { navigationColor: "red" } })).attributes.get(
        "style",
      ),
    ).toBe("--zoom-nav-color: red");
    expect(
      (await render({ animationDuration: 0 })).attributes.get("style"),
    ).toBe("--zoom-animation-duration: 0ms");
  });

  it("leaves out the images of the ignore prop and hands the selectors to the client", async () => {
    const { html, attributes } = await render(
      { ignore: ".logo, [alt='']" },
      '<img class="logo" src="/logo.svg" alt="Logo"><img src="/deco.jpg" alt=""><img src="/photo.jpg" alt="A photo">',
    );
    expect(attributes.get("data-image-zoom-ignore-selector")).toBe(
      ".logo, [alt='']",
    );
    expect(html).toContain(
      '<img class="logo" src="/logo.svg" alt="Logo"><img src="/deco.jpg" alt="">',
    );
    expect(html.match(/data-image-zoom-generated/g)).toHaveLength(1);
  });

  it("fails the build on a selector the server cannot match", async () => {
    await expect(render({ ignore: "article img" })).rejects.toThrow(
      /unsupported selector/,
    );
  });

  it("declares its display in its own shadow root, with no stylesheet on the page", async () => {
    const { html } = await render();
    expect(html).toMatch(
      /<astro-image-zoom\b[^>]*>\s*<template shadowrootmode="open"><style>:host \{ display: contents; \}<\/style><slot><\/slot><\/template>/,
    );
    expect(html).not.toContain("<link");
  });

  it("wraps the images of the slot in zoom links", async () => {
    const { html } = await render(
      {},
      '<p>Text</p><img src="/one.jpg" alt="One" data-image-zoom-caption="First"><a href="/big.jpg" data-image-zoom><img src="/small.jpg" alt="Two"></a>',
    );
    expect(html).toContain(
      '<a href="/one.jpg" data-image-zoom-generated data-image-zoom-caption="First" aria-label="Enlarge image: One"><img src="/one.jpg" alt="One" data-image-zoom-caption="First"></a>',
    );
    // Already in a link: left alone
    expect(html).toContain(
      '<a href="/big.jpg" data-image-zoom><img src="/small.jpg" alt="Two"></a>',
    );
    expect(html).toContain("<p>Text</p>");
  });

  it("renders no labels attribute by default: the overlay speaks English", async () => {
    const { attributes } = await render();
    expect(attributes.has("data-image-zoom-labels")).toBe(false);
  });

  it("hands the labels it is given to the overlay", async () => {
    const labels = { close: "Cerrar", next: "Siguiente imagen" };
    const { attributes } = await render({ labels });
    const value = attributes.get("data-image-zoom-labels")!;
    expect(JSON.parse(value.replaceAll("&quot;", '"'))).toEqual(labels);
  });

  it("names the zoom links with the labels", async () => {
    const { html } = await render(
      {
        labels: {
          enlargeNamed: "Ampliar imagen: {alt}",
          enlarge: "Ampliar imagen",
        },
      },
      '<img src="/one.jpg" alt="Uno"><img src="/two.jpg">',
    );
    expect(html).toContain('aria-label="Ampliar imagen: Uno"');
    expect(html).toContain('aria-label="Ampliar imagen"');
  });

  it("keeps the English name of the links for the labels it is not given", async () => {
    const { html } = await render({ labels: { close: "Cerrar" } });
    expect(html).toContain('aria-label="Enlarge image: A photo"');
  });
});
