# Astro Zoom Monorepo

This repository is a monorepo containing the source code for the `astro-image-zoom` component and a demo application.

## 📂 Project Structure

- **`packages/astro-image-zoom`**: The core library package. A Medium-style Zoom component for Astro.
- **`demo`**: A demo Astro project showcasing the usage of `astro-image-zoom`.

## 🚀 Getting Started

This project uses [pnpm workspaces](https://pnpm.io/workspaces) to manage dependencies. Use the Node version in `.nvmrc`.

### 1. Install Dependencies

Run the following command in the root directory to install dependencies for all packages:

```bash
pnpm install
```

### 2. Run the Demo

To start the development server for the demo application:

```bash
pnpm dev
```

This will start the demo at [http://localhost:4321](http://localhost:4321).

## 📦 Package Documentation

For detailed documentation on how to use the component, configuration options, and API, please refer to the [astro-image-zoom README](./packages/astro-image-zoom/README.md).

## 🛠️ Development

To build the demo:

```bash
pnpm build
```

To preview the built demo:

```bash
pnpm preview
```

## 📄 License

MIT
