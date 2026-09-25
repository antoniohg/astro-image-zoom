import { describe, expect, it } from 'vitest';
import imageZoom from '../integration.js';

const configFile = decodeURIComponent(new URL('../config.js', import.meta.url).pathname);

// Runs the setup hook of the integration and returns the Vite plugin it registers
function register(options?: Parameters<typeof imageZoom>[0]) {
  let plugin: any;
  const integration = imageZoom(options);
  (integration.hooks['astro:config:setup'] as any)({
    updateConfig: ({ vite }: { vite: { plugins: unknown[] } }) => {
      plugin = vite.plugins[0];
    },
  });
  return { integration, plugin };
}

describe('the integration', () => {
  it('is named after the package', () => {
    expect(register().integration.name).toBe('astro-image-zoom');
  });

  it('hands the translations to the component in place of config.js', async () => {
    const { plugin } = register({ labels: { es: { close: 'Cerrar "zoom"' } } });
    const source: string = await plugin.load(configFile);
    const config = await import(`data:text/javascript,${encodeURIComponent(source)}`);
    expect(config.default).toEqual({ labels: { es: { close: 'Cerrar "zoom"' } } });
  });

  it('leaves every other module alone', async () => {
    const { plugin } = register({ labels: { es: { close: 'Cerrar' } } });
    expect(await plugin.load('/somewhere/else.js')).toBeNull();
  });

  it('works with no options', async () => {
    const { plugin } = register();
    const source: string = await plugin.load(configFile);
    const config = await import(`data:text/javascript,${encodeURIComponent(source)}`);
    expect(config.default).toEqual({ labels: {} });
  });
});
