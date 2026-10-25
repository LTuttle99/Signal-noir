# Local validation — 25 October 2026

## Completed

- `npm run lint`: 159 JavaScript files/inline blocks parsed with Node, zero syntax failures. This is syntax lint, not a configured ESLint style/security analysis. There are no TypeScript sources to type-check.
- `npm test`: 38/38 SQLite query/security tests passed, covering cross-organization access, team membership, capabilities, sessions, injection resistance, schema constraints and audit retention.
- `npm run build`: static output generated successfully without Wrangler or installed npm dependencies. Build output excludes backend source, migrations, tests, secrets and repository metadata.
- Existing browser suites: shared 332/332; Studio 32/32; access 47/47; operations 51/51; projects 50/50; resilience 16/16; data analyzer 51/51. Total: 579 browser assertions plus 38 SQLite assertions passed.
- Landing page rendered in the in-app browser at a narrow/tablet viewport. Hero, floating compact navigation, question input, file action, primary CTA and starter prompts displayed without visible horizontal overflow.
- Comment removal used the JavaScript parser's comment ranges. ASTs before/after removal were identical for all processed JavaScript and inline scripts. CSS/HTML/SVG comments were removed separately; generated Tailwind and functional string content were retained.
- No deployment, production resource operation, data migration, DNS change, or secret exposure was performed.

## Local filesystem blocker during final QA

After the initial build and tests, macOS marked numerous source and generated files `compressed,dataless`. Reads of examples such as `tools/shared/workflow-ui.js` and `tests/vanessa.test.html` hung, including outside the sandbox. This blocked further browser scripts and re-running build/checks. Requests to macOS FileManager for local availability were accepted but did not promptly restore reads. No file-provider settings were changed.

The Vanessa and Connected browser suites did not produce completed results before this blocker. The Worker integration suite requires the included local SQLite test bridge and remains unverified in this run. Full Studio UI workflows, desktop/mobile breakpoint checks, keyboard/modal flows, upload/export round trips, offline behavior, production-server smoke tests, and live backend/provider integrations remain unverified. The earlier passing Studio suite checks analytical behavior, not every Studio view.

## Follow-up after files are available locally

1. In Finder, ensure this project is downloaded and available on the device, or copy it to a fully local directory. Preserve the existing files and working changes.
2. Run `npm run lint`, `npm test`, and `npm run build` again. Run `npm run dev` and visit every `tests/*.test.html` suite.
3. Start `python3 server/tests/d1_server.py 8032` for the Worker test bridge, then run `tests/worker.test.html`. The bridge is test infrastructure only.
4. Check the home question/file/demo handoff, Studio project import/export and analysis, tool upload/results/export, library search/favorites, team access, settings, dialogs/keyboard focus, desktop/tablet/mobile, light theme, reduced motion and offline reload.
5. Stop development, run `npm run start`, and verify the production static build, API unavailable behavior, headers, and that dotfiles/server/test paths are inaccessible.

Connected Mode remains dependent on the existing D1/R2 backend. See DEPLOYMENT.md before any hosting cutover. The overall application is not certified production-ready by this validation pass.
