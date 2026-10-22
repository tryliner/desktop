# Liner packaging for Arch Linux

Two AUR packages for the Liner desktop client, kept in the upstream repository
so the recipes are versioned and reviewable next to the app.

| Package | What it installs | Tracks | Arches | Build time |
| --- | --- | --- | --- | --- |
| `liner-desktop-bin` | the prebuilt upstream `.deb`, repacked for Arch | release tags | `x86_64` | seconds |
| `liner-desktop-git` | built from the upstream git sources | default branch | `x86_64`, `aarch64` | 10-20 min |

They install the same paths, so they `conflict=` each other — install one.

`liner-desktop-bin` is the release build: it is pinned to a tag and only
changes when a release is published. `liner-desktop-git` is the rolling
build: it always builds the tip of the upstream default branch and derives
its version from the git history (`0.1.40.r32.g5d7e457`).

Both keep the upstream name and icon; the package names are deliberately
neutral so they do not read as official releases of the project.

## How the AUR works

For readers who have never packaged for Arch: the AUR (Arch User Repository)
is Arch Linux's community repository. Its mental model is the inverse of npm
or GitHub Releases.

**It hosts recipes, not artifacts.** Each AUR package is a small git
repository on `aur.archlinux.org` holding a `PKGBUILD` (a bash script with the
package metadata and the build steps) and a generated `.SRCINFO` (a
machine-readable snapshot of that metadata).

**Nobody builds anything for the user.** When someone runs `paru -S
liner-desktop-bin`, *their* machine clones the recipe, downloads the `.deb`
from *our* GitHub release page, verifies its checksum, repacks it and installs
it. `makepkg` never needs root; `pacman -U` installs the result.

**So we never redistribute the binary.** The recipe contains a URL and a
checksum and nothing else. The AUR stores zero bytes of Liner.

That is also why these recipes live in this repository rather than in the AUR
directly: they are versioned and reviewable next to the app they build, and
the AUR repositories only ever receive the four files of a recipe.

### The files in a recipe directory

- `PKGBUILD` — the recipe itself: name, version, dependencies, sources,
  checksums and the `prepare()`/`build()`/`package()` steps. It is plain
  bash and can be read top to bottom without knowing anything about Arch
  packaging.
- `.SRCINFO` — generated from the `PKGBUILD`, never edited by hand. The AUR
  serves this file rather than the `PKGBUILD`, so it has to be regenerated
  whenever the recipe changes; a stale `.SRCINFO` is the usual reason an AUR
  package stops working.
- `liner.desktop`, `liner-wrapper.sh` — local files listed in `source=()` and
  shipped in the package.

Every entry in `source=()` is verified against `b2sums` before the build
starts, **including the local files**. Editing `liner.desktop` by hand
therefore breaks the build with `liner.desktop ... FAILED` until the
checksums are refreshed — that is what `bump.sh` is for.

### The vocabulary

| Term | Meaning |
| --- | --- |
| package base | the name of the recipe repository on the AUR; it does not have to match `pkgname` |
| `pkgver` / `pkgrel` | the upstream version / a counter bumped when only the packaging changed |
| `depends` / `optdepends` | required at runtime / used when present |
| `makepkg` | builds the recipe into a `.pkg.tar.zst`; runs as the user, no root needed |
| `-bin` / `-git` | AUR naming conventions: repack a prebuilt binary / build from the tip of a branch |

### The lifecycle of a release

1. A release is tagged and GitHub publishes `liner_<version>_amd64.deb`.
2. `release.yml`'s `sync-aur` job runs after the release is published and
   calls `bump.sh`, which sets `pkgver` and recomputes the checksums.
3. `publish.sh` regenerates both `.SRCINFO` files and pushes the recipes to
   the two AUR repositories.
4. On the user's machine, `paru -Syu` picks up the new version.

### What a maintainer has to do

Once: create the two AUR package bases and add the `AUR_SSH_KEY` secret (see
[Publishing to the AUR](#publishing-to-the-aur)). After that, nothing on a
release day — the workflow does the bump. The only recurring tasks are
reviewing the occasional automated change and rotating the ssh key if it ever
leaks.

## Layout

```
packaging/aur/
├── README.md            this file
├── bump.sh              bump the recipes to an upstream version
├── publish.sh           regenerate .SRCINFO and push to the AUR
├── common/              files shared by both recipes
│   ├── liner.desktop    desktop entry
│   └── liner-wrapper.sh launcher that marks the build
├── liner-desktop-bin/   PKGBUILD + .SRCINFO for the prebuilt package
└── liner-desktop-git/   PKGBUILD + .SRCINFO for the source-built package
```

`common/` is the single source of truth for the files both recipes ship;
copy them into a recipe directory whenever they change:

```sh
cp packaging/aur/common/liner.desktop packaging/aur/liner-desktop-bin/
cp packaging/aur/common/liner.desktop packaging/aur/liner-desktop-git/
cp packaging/aur/common/liner-wrapper.sh packaging/aur/liner-desktop-bin/
cp packaging/aur/common/liner-wrapper.sh packaging/aur/liner-desktop-git/
```

Then refresh the checksums, otherwise the build fails with
`liner.desktop ... FAILED`:

```sh
./packaging/aur/bump.sh 0.1.40
```

`bump.sh` rewrites the whole `b2sums` array of both recipes: the downloaded
`.deb` and license from upstream, the local files from the recipe
directory.

## Building locally

```sh
cd packaging/aur/liner-desktop-bin
makepkg -si          # repacks the upstream .deb, installs liner-desktop-bin
```

The source-built package needs node and a working toolchain:

```sh
sudo pacman -S --needed base-devel nodejs-lts-krypton git
cd packaging/aur/liner-desktop-git
makepkg -si          # builds from source, installs liner-desktop-git
```

`makepkg` downloads the node modules, the electron runtime and the electron
builder binaries, so the first build needs a few hundred megabytes of
network traffic.

## Publishing to the AUR

### One time setup

1. Create an AUR account and add an ssh public key to it.
2. Create the two package bases by pushing an empty repository to them once:

   ```sh
   git clone ssh://aur@aur.archlinux.org/liner-desktop-bin.git
   git clone ssh://aur@aur.archlinux.org/liner-desktop-git.git
   ```

3. Load your AUR key into the agent and publish:

   ```sh
   ssh-add ~/.ssh/id_aur
   ./packaging/aur/publish.sh
   ```

   `publish.sh` regenerates the `.SRCINFO` files and pushes the recipes to
   both AUR repositories. It needs `makepkg` (or docker) for the `.SRCINFO`
   generation.

### Bumping to a new upstream release

```sh
./packaging/aur/publish.sh 0.1.41
```

This updates `pkgver` in the `liner-desktop-bin` recipe, recomputes the
checksums of the upstream `.deb` and the license file, refreshes the version
of the rolling `liner-desktop-git` recipe, regenerates `.SRCINFO` and pushes
everything to the AUR.

### Automatic sync

Two jobs keep the AUR current; no manual step is needed on a release day:

- `release.yml`'s `sync-aur` job runs on every tag, after the release is
  published. It bumps `-bin` to the tagged version (downloading and hashing the
  new `.deb`) and pushes both recipes.
- `aur-sync.yml` runs daily (and can be run manually from the Actions tab).
  Without a version argument it only refreshes the recorded version of
  `liner-desktop-git`, which follows the upstream branch — the `-bin` recipe
  does not change between releases, so it reports "no changes, skipping".

  With a version argument it does the full bump instead. Use that path if a
  release was ever published by hand rather than via a tag: an upload through
  the GitHub web UI does not push a tag, so `release.yml` would not run.

To enable any of this, add the private key of the AUR account as the
`AUR_SSH_KEY` secret of the repository:

```sh
gh secret set AUR_SSH_KEY < ~/.ssh/id_aur
```

Both jobs fail loudly while the secret is missing — that is the signal that
setup is incomplete. The workflow pushes to the AUR over ssh using that key;
the AUR host key is pinned in the workflow files. Update them if the AUR host
key ever rotates.

## Notes

- **Build marker.** `/usr/bin/liner` is a small wrapper that exports
  `LINER_BUILD_FLAVOR="AUR BUILD"` and then execs the real binary. The app
  reads that variable in the electron main process and shows it next to the
  core version in the about screen, so an AUR install can be told apart
  from an official release build:

  ```
  Client 0.1.41 (a1b2c3d) · Core 0.1.40-r32.g5d7e457 · AUR BUILD
  ```

  The marker lives in the core on purpose: the renderer bundle (the client)
  can be replaced by an OTA update, the core cannot.
- **Core version.** `liner-desktop-git` injects the makepkg version into the
  packaged app (`0.1.40.r32.g5d7e457` becomes `0.1.40-r32.g5d7e457`), so the
  about screen shows which upstream commit the build came from.
  `liner-desktop-bin` ships the upstream binary unchanged and therefore
  keeps the upstream version.
- **Dependencies.** The dependency list is derived from the binary itself:
  the libraries it links directly (`readelf -d`) plus the ones it loads at
  runtime. `gtk3` covers the rest — cairo, pango, at-spi2-core, dbus,
  expat, mesa, nss/nspr, wayland, the x11 libraries and `libcups`.
  Chromium links the print backend, so `libcups` has to be present even
  though the app never prints; the package does not add it, every gtk3 app
  on Arch already pulls it in.
- **Updates.** The app's own electron-updater is inert for a native install
  (it only activates for AppImage builds), so pacman owns the app version
  and there is no in-app update that fights the package manager. The
  separate OTA bundle updater (`updates.tryliner.fun`) stays enabled and can
  hot-swap renderer bundles outside of pacman.
- **Sandbox.** `chrome-sandbox` is installed `0755` and relies on
  unprivileged user namespaces, which Arch enables by default. Nothing is
  installed setuid.
- **aarch64.** Upstream only publishes `x86_64` Linux builds, so
  `liner-desktop-bin` is `x86_64` only. `liner-desktop-git` covers
  `aarch64` by cross-packaging the electron runtime.
- **License.** Liner is source-available and non-commercial, so the recipes
  declare `license=('custom:Liner-Source-Available')` and install the
  upstream license into `/usr/share/licenses`.
