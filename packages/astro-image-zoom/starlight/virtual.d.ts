// The options of the Starlight plugin, served by its Vite plugin to the MarkdownContent override
declare module "virtual:astro-image-zoom/starlight-config" {
  const options: import("./index").StarlightImageZoomOptions;
  export default options;
}
