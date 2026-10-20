# Course Planner — coming-soon landing page

A dependency-free, static marketing page for a teacher curriculum-planning application. The design uses a dark, modular workspace with purple interactive accents and an American Government curriculum preview.

## Architecture

- `index.html`: semantic page sections, preview shell, local SVG icon library, and product-status disclosures.
- `assets/styles.css`: preserved marketing-page design tokens and responsive styling.
- `assets/demo.css`: connected planning preview, responsive workspaces, and modal styling.
- `assets/preview.js`: shared fictional course/unit/lesson records, local sample editing, templates, and a bounded scheduling demonstration; no persistence, network requests, or backend.
- `docs/product/course-planner-unified-spec-2026-10-20.md`: authoritative product and demo specification, with lowercase directory names for consistent paths on case-sensitive systems.

No framework, package installation, build, lint, or type-check commands are configured. Serve the repository root unchanged. Existing GitHub/Vercel hosting settings are preserved.

## Local preview

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000. Use a local HTTP server rather than opening the file directly.

## Preview interactions

The four workspaces share stable sample unit and lesson IDs. One fictional American Government course contains three units and ten lessons in September 2026. One workshop spans two instructional days; ten lesson records therefore occupy eleven lesson days.

- **Course Sequence:** course-wide master table, unit filtering/All Units, title search, and Board presentation of the same filtered records. Change a sample planning status inline, open a lesson, or open its Unit Plan.
- **Unit Planning:** overview, editable Essential Question and target days, independent expandable sections for purpose, understandings, outcomes, assessment, supports, texts, and notes. Connected lessons open their shared records. Changing target days updates pacing variance without rescheduling.
- **Lesson Planning:** previous/next and lesson selector; inherited unit Essential Question; lesson-owned Guiding Question; editable structured modules. Preview and apply a lesson-specific template; omitted modules retain their fields and remain accessible.
- **Calendar:** true monthly grid and local weekly agenda, period navigation, selectable days, contextual lesson links, and distinct lesson/assessment/closure/exception/flex/pin labels.
- **Customization:** change the illustrative course default for future lessons without altering existing lesson templates; preview lesson overrides in Lesson Planning; try five unit colors.

All changes are disposable browser-memory state. Reloading resets the sample. There is no persistent save indicator or storage. Resource names are illustrative labels, not downloads or connected files. Standards are explicitly fictional samples.

### Bounded schedule example

“Stories of September 11, 2001” (`lesson-september-11-stories`) is a Special Lesson pinned to September 11, 2026, with age-appropriate fictional planning materials. The Ratification Debate retains its original ID and instructional content as an assessment on September 14. “Making the Laws” and “The Executive Branch” start In Progress; Ready and Draft examples remain.

Each Calendar preview is an independent scheduling example built from the initial sample fixture. Opening or canceling a preview changes nothing. Confirm explicitly replaces earlier **demo scheduling** changes with the chosen scenario; authored lesson fields, statuses, unit edits, and templates remain intact. The dialog’s Before column always refers to the initial scenario baseline, as disclosed above the impact summary.

- **Flexible Move:** Making the Laws moves September 15 → 16 with a flexible preference. The Executive Branch moves September 16 → 18; Interpreting the Law moves September 18 → 21, skipping September 17 testing.
- **Pin to Date:** the same dates, with Making the Laws protected on September 16.
- **Closure/recalculation:** starts from a flexible September 16 preference and closes that day. The final three lessons occupy September 18, 21, and 22. The September 11 pin, September 14 assessment, and two-day workshop stay intact.

Visitors can confirm all three in order, repeat them, or try any order without inheriting a prior example’s pin or closure. This isolation applies to scripted examples only. The underlying pure recalculation retains supplied pins and blocks confirmation if any protected date is unavailable; it never silently clears a pin or schedules instruction on a closure. Automated verification includes a deliberate September 16 protected-pin conflict.

This simulation handles only the final three one-day lessons and the named sample rules. It does not implement a general scheduling engine, arbitrary drag-and-drop placement, or a persistent template library. Full product behaviors such as create/duplicate/archive/reorder are specified as future application work; they are not implied by inert demo buttons.

## Product status and scope

The existing prototype lives in Google Sheets. Course Planner is in development. Customization and linked-resource concepts are design directions, not confirmed launch functionality. This page introduces no authentication, signup forms, analytics, third-party integrations, external fonts, student information, or backend changes.

## Deployment

The existing Vercel project serves this static repository using the **Other** preset with no build command. A push to the connected production branch triggers deployment. The redesign must be reviewed and explicitly authorized before publishing to production.

## Redesign verification

The October 20 implementation is reviewed against the specification's 14 acceptance checks at 1440px and 390px. Browser verification and screenshots are delivered outside the repository under `/Users/Shared/From AI/Course-Planner-Redesign-2026-10-20/`; see its implementation report and verification evidence for results and limits.

A focused visual refinement pass compacted mobile Course Sequence rows, made selected unit titles prominent, clarified scheduling-impact previews, and replaced platform-specific development wording. The specification now lives at the case-consistent `docs/product/` path with unchanged contents. Follow-up screenshots and verification are in `/Users/Shared/From AI/Course-Planner-Refinement-2026-10-20/`.

No lint, type-check, build command, or additional package dependencies are introduced. Verification uses the actual browser interface, shared-record assertions, calendar date checks, JavaScript error monitoring, overflow checks, and `git diff --check`.

Review the local implementation before authorizing any commit, push, or production deployment.

## Local regression verification

With the local preview running, execute `python3 tests/verify_demo.py`. The standard-library browser harness requires Google Chrome at its standard macOS application path. It covers all 14 specification acceptance checks at 1440px and 390px, the three-confirmation visitor journey, independent/repeated scenarios, shared statuses, the remembrance lesson, and protected-pin rejection. No test packages or website dependencies are added.

Review evidence is written to `docs/reviews/interactive-demo-2026-10-20/`; it is local review material, not a runtime asset or an instruction to publish it. The unified product specification is unchanged.
