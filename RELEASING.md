# Releasing astro-image-zoom

How a new version of the package gets from `main` to npm and GitHub. Everything here happens by
hand; nothing publishes on its own.

## What gets published

Only `packages/astro-image-zoom`, under the name `astro-image-zoom` on
[npm](https://www.npmjs.com/package/astro-image-zoom). The rest of the repository (the demo, the
tests, these docs) stays on GitHub.

The `files` field of `packages/astro-image-zoom/package.json` decides what goes into the package:

| File | Why |
|---|---|
| `index.js` | `import { ZoomClass } from 'astro-image-zoom'` |
| `ImageZoom.astro` | The component |
| `zoom.ts` | The client code: the `Zoom` class |
| `overlay.css` | The overlay styles, imported by `zoom.ts` with `?inline` |
| `env.d.ts` | The types of that `?inline` import |
| `wrapImages.ts` | Wraps the images in links, on the server |
| `zoom.css` | The page styles (cursor, focus ring) |
| `README.md` | The page of the package on npm |

npm adds `package.json` and pnpm adds the `LICENSE` of the repository root. The package ships
TypeScript and `.astro` sources: Astro compiles them in the site that installs it, so there is no
build step.

Other fields that matter on npm: `name`, `version`, `description`, `keywords`, `author` (no email:
it would be public), `license`, `repository` (with `directory`), `homepage`, `bugs`, `exports` (the
entry points a site may import) and `peerDependencies` (the Astro versions it supports).

## Versions and tags

Versions follow [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`, and a suffix for
pre-releases.

- **Beta:** `0.1.0-beta.0`, `0.1.0-beta.1`… Increase the last number on each beta.
- **Stable:** `0.1.0`. Before 1.0, a breaking change raises the minor (`0.2.0`), anything else the
  patch (`0.1.1`). From 1.0 on, a breaking change raises the major.

npm keeps a **dist-tag** per channel, which decides what `pnpm add astro-image-zoom` installs:

| dist-tag | Installs with | Points to |
|---|---|---|
| `latest` | `pnpm add astro-image-zoom` | The last stable version |
| `beta` | `pnpm add astro-image-zoom@beta` | The last beta |

Publish betas with `--tag beta`, or they become `latest`. The very first version of a package is
always `latest` too, whatever tag it was published with: until 0.1.0 comes out, `latest` points to
a beta.

Each release also gets a git tag, `v` plus the version (`v0.1.0-beta.1`), and a GitHub release with
its notes.

## Before the first release (done once)

- An [npm account](https://www.npmjs.com/signup) with two-factor authentication. Its email appears
  in the public metadata of every version (`npm view astro-image-zoom maintainers`): use an address
  you do not mind being public.
- Logged in on this machine: `npm login` (it opens the browser). The token lands in `~/.npmrc`:
  never copy it anywhere.
- The name must be free: `npm view astro-image-zoom` answers 404 for a free name.

## Release checklist

### 1. Check that `main` is ready

```bash
git switch main && git pull
pnpm install
pnpm test          # unit tests
pnpm test:e2e      # end-to-end tests
pnpm build         # the demo still builds with the package
```

The last CI run of `main` must be green (`gh run list --branch main --limit 1`). Check that the
package README covers every change of the release (new props, variables, behavior).

### 2. Write the release notes

List what changed for the people who use the package since the last version, grouped as
**Added**, **Changed**, **Fixed** and **Breaking changes**. Start from the commits:

```bash
git log --oneline v0.1.0-beta.0..main -- packages/astro-image-zoom
```

Leave out tests, refactors and anything a user would not notice. Keep the notes in a file outside
the repository (for example `/tmp/notes.md`) for step 7.

### 3. Set the version

Edit `version` in `packages/astro-image-zoom/package.json`, then commit, tag and push:

```bash
git add packages/astro-image-zoom/package.json
git commit -m "chore(release): prepare 0.1.0-beta.1"
git tag v0.1.0-beta.1
git push origin main v0.1.0-beta.1
```

`npm version` and `pnpm version` would also do this, but they commit and tag from the package
folder; editing by hand keeps it explicit.

### 4. Check the package

```bash
cd packages/astro-image-zoom
pnpm pack --pack-destination /tmp
tar -tzf /tmp/astro-image-zoom-0.1.0-beta.1.tgz
```

Expect the files of the table above, `package.json` and `LICENSE`, and nothing else: no `test/`,
`e2e/` or `vitest.config.ts`.

To try the tarball in a real site before publishing:

```bash
cd ../some-astro-site
pnpm add /tmp/astro-image-zoom-0.1.0-beta.1.tgz
```

That writes a `file:` dependency into the site's `package.json`: do it on a throwaway branch. If
pnpm complains about the store location (`ERR_PNPM_UNEXPECTED_STORE`), pass the store the site
already uses with `--store-dir`.

### 5. Publish

From the package folder:

```bash
cd packages/astro-image-zoom
pnpm publish --tag beta --access public --no-git-checks
```

- `--tag beta`: for a beta. Leave it out for a stable version, which goes to `latest`.
- `--access public`: needed for the first publish of a package, harmless afterwards.
- `--no-git-checks`: pnpm refuses to publish with uncommitted files anywhere in the repository.
  Leave it out when the working tree is clean.

npm asks for the two-factor code. Where the command cannot prompt for it (a script, or a terminal
that is not interactive), pass it with `--otp=123456`. Run it from
the package folder: from the repository root pnpm would try to publish the private workspace
package, and refuse.

If `pnpm` and `npm` run through the Socket wrapper, it catches some flags as its own: `--dry-run`
stops it before pnpm runs, and `-c` is read as its config. To see what would be published, use
step 4.

### 6. Check the published version

```bash
npm view astro-image-zoom dist-tags
npm view astro-image-zoom@0.1.0-beta.1 dist.fileCount dist.unpackedSize
```

`beta` must point to the new version. Then install it in a site
(`pnpm add astro-image-zoom@beta`) and open a few images.

### 7. Create the GitHub release

```bash
gh release create v0.1.0-beta.1 --prerelease --title "0.1.0-beta.1" --notes-file /tmp/notes.md
```

`--prerelease` for betas; leave it out for stable versions.

## Stable releases

Same checklist, with a version without suffix (`0.1.0`), published without `--tag` (it becomes
`latest`) and a GitHub release without `--prerelease`. Update the install command of the package
README first: `pnpm add astro-image-zoom`, without `@beta`.

## When something goes wrong

- **A published version cannot be replaced.** npm never accepts the same version twice, even after
  deleting it. Fix the problem and publish the next version.
- **Deprecate a broken version:** `npm deprecate astro-image-zoom@0.1.0-beta.1 "Broken, use 0.1.0-beta.2"`.
  Installs keep working, with a warning.
- **Unpublish:** only within 72 hours of publishing, and only if no other package depends on it:
  `npm unpublish astro-image-zoom@0.1.0-beta.1`. Prefer deprecating.
- **A tag points to the wrong version:** move it with
  `npm dist-tag add astro-image-zoom@<version> <tag>`.

## Our own supply-chain rules

We do not install versions published less than 48 hours ago, and that includes our own package from
npm. To try a release in a site before that, install the tarball of step 4 instead.

## Later

- **Publish from GitHub Actions** with [trusted publishing](https://docs.npmjs.com/trusted-publishers):
  no token on any machine, and npm shows a provenance statement that links each version to the
  commit and the workflow that built it.
- **A `CHANGELOG.md`**, if GitHub releases stop being enough.
