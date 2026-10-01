// Vite imports a stylesheet with ?inline as a string, minified in production builds.
// Astro projects get this from astro/client; declared here so zoom.ts type-checks on its own.
declare module "*.css?inline" {
  const css: string;
  export default css;
}
