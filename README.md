# Signal Noir

A local-first analytics workspace with Vanessa, Studio, dashboards, and 26 focused tools.

## Upload this folder to GitHub

Create an empty GitHub repository, then upload the **contents of this folder** to its root. `package.json`, `index.html`, `site/`, and `tools/` should be directly at the repository root, not inside another folder. Include the hidden `.gitignore` and `.node-version` files when using Git or GitHub Desktop. No credentials or existing Git history are included.

## Deploy with Cloudflare Pages

In Cloudflare, create a **Pages** project and connect the GitHub repository. Use these build settings:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Production branch | Your uploaded branch, normally `main` |
| Root directory | Repository root (leave blank) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Build environment variable | `NODE_VERSION` = `22` |

Use Pages Git integration; no Wrangler command, deploy command, or API token belongs in this repository. Cloudflare builds the static site from the source and serves only `dist/`. `_headers` is copied into the build. Connecting Git integration enables future deployments from pushes to the configured branch.

Official setup: https://developers.cloudflare.com/pages/get-started/git-integration/
Build settings: https://developers.cloudflare.com/pages/configuration/build-configuration/

## Local commands

Requires Node.js 22 or newer. No npm dependencies need installing.

```sh
npm run dev
npm run lint
npm run build
npm run start
```

The local address is `http://127.0.0.1:8020`. Stop development before starting production, or set `PORT` to another port. `npm test` additionally requires Python 3.

## Connected Mode

This package deploys the static, browser-local application. Existing projects remain in the browser where they were created; uploading the repository does not transfer browser data. Export/import projects through the app when transferring them.

The retained `server/` directory contains the existing Connected API and SQL schema, but Pages does not automatically activate that backend or bind its D1/R2 services. Connected authentication, shared data and server storage require a separately configured API. Keep existing production databases and buckets intact. See `DEPLOYMENT.md` for the infrastructure inventory and migration requirements. Do not add secrets to GitHub.

`VALIDATION.md` records prior checks and verification limits; see `PACKAGE-CHECKS.md` for checks run on this exact upload copy. Nothing has been uploaded or deployed by preparing this folder.
