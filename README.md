# Globe

A standalone, full-frame version of GitHub's animated activity globe.

The rendering code is derived from GitHub's MIT-licensed `@github/webgl-globe` project. This fork deliberately removes the surrounding homepage presentation, mascot/head overlays, hover cards, and Arctic Code Vault overlay so the page is just the globe.

## Run locally

```bash
npm install
npm run dev
```

## Data

The renderer ships with GitHub's historical sample dataset so it works immediately.

After this branch is merged, `.github/workflows/refresh-data.yml` polls GitHub's public Events API every ten minutes. It looks for public pull-request activity, resolves public profile locations, geocodes a small cached number of new locations with OpenStreetMap Nominatim, and writes the resulting coordinates into `public/data/data.json`.

Open PRs appear as blue spikes. Merged PRs can produce the pink opener-to-merger arcs when both users expose geocodable public locations.

The GitHub Events API is delayed and is not a real-time firehose; the globe continuously replays the latest available sample.

## GitHub Pages

`.github/workflows/deploy-pages.yml` builds the Vite app and deploys `dist/` with GitHub Pages.

If Pages has not yet been enabled for the repository, choose **Settings → Pages → Source → GitHub Actions** after merging the PR.

## Attribution

Renderer derived from GitHub's `@github/webgl-globe`, MIT licensed. See `NOTICE.md`.
