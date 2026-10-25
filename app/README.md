# Course Planner /app — isolated application preview

Status: **separate static development page** on `pilot/app-foundation`. It is NOT the authenticated/persistent teacher pilot.

- Marketing site remains in the existing repository root and stays unchanged.
- The standalone app uses the existing fictitious interactive course preview's **identical** `preview.js`, `styles.css`, and `demo.css` assets, copied as Git blobs so they can deploy independently with Vercel Root Directory `app`.
- Reuses the existing shared-record views and demo scenario mechanics while removing the marketing sections. Do not treat the client-side demonstration as a production-ready scheduler.
- All changes are browser-memory only and reset on reload. There are no saved accounts, database, mailing list, cloud backups, or school-data connections.
- The Sprint 1 independent domain-model experiment is a separate reference and has **not yet been integrated** with these demo records. Do not create a second authoritative lesson database.
- The current marketing Vercel project is separate from the app. **Never repoint its root directory or production branch to this folder.**

Local check: `python3 -m http.server 8000` from the repository root; visit `http://127.0.0.1:8000/app/`.
Static test: `cd app && npm test`. Browser integration and the 265-assertion demo regression suite must also be rerun before production launch.

## Next gates

1. Compare the current shared demo record structure to the tested Sprint 1 domain model and canonical V2.2 workbook.
2. Add authenticated hosted storage, recovery, explicit pending/saved/error UI; verify a teacher can save, close, reopen and edit across two browser sessions.
3. Verify dates, stable IDs, partial-duration lessons, protected pins, exceptions and all relevant scheduling behavior against the workbook.
4. Build export and import, then recruit first users. Do not use real student information.

This app directory is suitable for a **separate Vercel project rooted at `app`**, but publishing it is a distinct operation.
