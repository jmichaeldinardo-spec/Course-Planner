# Course Planner — Unified Product and Website-Demo Specification

**Version:** Design baseline 1.0  
**Date:** October 20, 2026  
**Status:** Consolidation of approved design decisions; not an implementation report  
**Target:** Initial Course Planner web application and its separate public landing-page demonstration

## 1. Product proposition and scope

Course Planner is a teacher-controlled planning workspace that connects **Course → Unit → Lesson** with instructional scheduling. A teacher should be able to organize an entire course, author units and lessons in purpose-built interfaces, and see a calendar generated from that shared information. The central value is **connected planning**, not simply colorful cards or document storage.

**Three distinct realities must not be conflated:**

1. **Existing Google Sheets prototype:** The live workbook *Course Planner — V2.2 — Teacher Workflow Development* is the reference for working planning relationships, fields, unit pacing, lesson sequencing, calendars, and exceptions. It is not a requirement to reproduce its spreadsheet machinery or exact screen layouts in a web app.
2. **Intended product:** The behavior specified here, some of which does not yet exist and will require engineering, reliable persistence, permissions, and Google Sheets integration.
3. **Public website demonstration:** A coherent, fictional interactive preview that illustrates selected workflows but does not write to Google Sheets, store user work, or claim to be a working production application.

The current public site is **one landing page with an embedded multi-state sample interface**, not a collection of separate app routes. Preserve its recognizable dark, Obsidian-inspired visual identity, colored unit cards, responsive structure, section navigation, and honest in-development messaging; correct the preview's information architecture.

## 2. Shared architecture and data ownership

| Information | Authoritative record/source | Where seen or edited |
| --- | --- | --- |
| Courses and order of units | Course structure | Course navigation, Course Sequence, Unit Planning |
| Unit identity, purpose, Essential Question(s), learning outcomes, assessment strategy, target days | **Unit Planning** unit record | Edited in Unit Planning; inherited or summarized elsewhere |
| Lesson identity, order, title, type, status, detailed instructional fields | **Course Sequence** master lesson record | Quick editing in Course Sequence; detailed editing in Lesson Planning; read-only contextual display elsewhere |
| Lesson Guiding Question(s) | Lesson record | Authored in Lesson Planning; optionally shown in Course Sequence |
| Scheduled dates | Scheduling engine informed by ordered lessons and calendar rules | Displayed in all relevant workspaces; schedule inputs managed in Calendar |
| School closures, instructional exceptions, reserved flex time, fixed assignments, flexible date preferences | Calendar rules and scheduling constraints | Managed through Calendar |
| Lesson resource references | Lesson-linked data | Primarily within Lesson Planning, optionally a supporting Resources surface |
| Layouts, templates, field/module definitions | Configuration data | Course defaults, lesson overrides, reusable template library |

- **Do not create a second lesson database in Lesson Planning.** Multiple editing views reference the same lesson identity.
- A hidden permanent **Lesson ID**, not a mutable Lesson/Sequence number, anchors relationships. A new or duplicated lesson gets a new ID. Reordering retains identity and all authored content. Apply the same stable-ID principle to units and reusable custom fields.
- Unit Essential Questions are created at unit level and shown automatically in relevant lessons. Lesson-level questions are explicitly **Guiding Questions**.
- Displayed unit/lesson numbers and dates may be recalculated; they are not record identities.
- The initial proposed Google Sheets-backed web app should use the existing workbook architecture cautiously, not silently modify schemas or the bound Apps Script. Any future Apps Script change must update the **entire** canonical Google Doc *Course Planner — Canonical Apps Script (Code.gs)* before manual replacement of Code.gs, preserving macros.gs unless necessary. **No spreadsheet or script changes are authorized by this specification.**
- Changes must have explicit save/pending/error states when persistence eventually exists. Avoid accidental duplicate records, unsynchronized writes, or silent data loss. Google Sheets-backed two-way synchronization remains an engineering requirement, **not a function of the website demo**.

## 3. Workspace A — Course Sequence

### Purpose
Answer: **What am I teaching, in what order, and where am I in the course?**

### Layout
- Default: **course-wide ordered master table**, grouping every lesson under color-coded unit headings. Show all units at first load.
- Colored unit cards above the table navigate/filter. Clicking a unit filters to it; selecting it again or choosing **All Units** restores the whole course. Provide a distinct **Open Unit Plan** action.
- Recommended default columns: Sequence #, Lesson Title, Unit, Type, Planning Status, Scheduled Date. Allow configurable additional columns (chapter, pages, section, objective, standards, Guiding Questions, resources, etc.).
- Header summary: course name, number of units/lessons, relevant assessment/pacing summary, search/filter, **+ Lesson**. Side contextual pacing/calendar panel is optional/collapsible.
- Board is a secondary **Course Sequence view** grouping course lessons by unit. Table and Board change presentation, not the information scope or data owner. A selected-unit filter is explicitly shown in both.

### Interaction rules
- **Hybrid inline editing:** click status/type to choose a value; edit title and other safe compact fields in place. Click title/open action for full Lesson Planning.
- **Create lesson:** minimal title, unit, type, insertion position. Detailed planning is optional later. Allocate a new stable Lesson ID.
- **Duplicate lesson:** copy planning information into an independent new record with new Lesson ID; default next to source; duplicated status should not imply the lesson was already taught. References to files may be reused without copying files.
- **Reorder within or between units:** drag handle and keyboard/menu move commands. Unit assignment and unit-inherited context update when a lesson changes units. Preserve all other lesson data.
- **Archive/restore:** remove from active sequence while preserving content; any permanent delete should be a distinctly warned, recoverable operation.
- **Impactful structural edits:** before applying a move or archival operation that affects the schedule, show the affected lesson dates, fixed-date constraints, gaps, and conflicts. Do not commit silently. Ordinary title/status changes should not trigger a schedule preview.

## 4. Workspace B — Unit Planning

### Purpose
Answer: **What should students understand or accomplish across this unit, and how do its lessons contribute?**

### Layout and fields
- Default: **overview with independently expandable, editable sections**, not a second lesson list and not a mandatory guided wizard.
- Top: unit title, position, target days, planned instructional days, start/end dates where available, and explicitly labeled pacing variance.
- Highlight unit **Essential Question(s)**. Include editable expandable sections for: purpose/rationale; enduring understandings; priority standards and learning outcomes; culminating assessment and formative evidence; vocabulary, prerequisites, misconceptions and scaffolds; core texts/resources; notes.
- **Connected Lessons** are pulled from the shared lesson collection. Each title opens Lesson Planning; **+ Lesson** creates a record in this unit.
- Multiple sections can stay open; collapse state may be remembered. Inherited/calculated values should look different from editable unit fields.

### Interaction rules
- **+ Unit:** quick create with title, position, optional target days and color; create an independent stable Unit ID immediately. Optional prompts may help after creation, never block creation.
- Unit navigation: selector, Previous/Next Unit, and links from Course Sequence.
- Reordering or archiving a unit preserves identity and its lessons, and uses the same schedule-impact preview. Copying a unit can copy just unit-level planning or the unit **with duplicated lessons**, assigning new identities.
- Editing Unit Essential Questions automatically updates the context shown in associated lesson plans; it does not duplicate the source value.
- Editing target days updates pacing indicators. **It does not, by itself, silently reschedule lessons.** A planned assessment at unit level is not automatically a dated calendar entry until scheduled/linked.
- A completeness checklist is an optional later enhancement, not an instructional-quality score or launch commitment.

## 5. Workspace C — Lesson Planning

### Purpose
Answer: **How will I teach this particular lesson, assess learning, and prepare its materials?**

### Layout and field model
- Header: title, unit, sequence position, type, planning status, scheduled date, contextual textbook metadata when relevant, saved/pending/error state in a real app.
- Inherited read-only unit **Essential Question(s)**, with a link back to Unit Planning. Author lesson **Guiding Question(s)** in the lesson record.
- **Structured but customizable modules**, with rich text/freeform areas where appropriate. Suggested default modules: Learning Goals (objectives, standards, Guiding Questions); Instructional Content/Activities (including sources, vocabulary); Assessment; Differentiation; Materials & Resources; Homework, Notes, Reflection.
- Preserve existing prototype fields. Teacher-specific sections such as Do Now, Mini-Lesson, Guided Practice, Independent Practice may be optional custom fields, not hard-coded universal requirements.
- Previous/Next Lesson, searchable lesson selector, and direct navigation from Course Sequence, Unit Planning, and Calendar. Sidebars are optional/collapsible. Multiple modules may stay expanded.

### Templates and editing rules
- **One course-level default template** for new lessons; **optional per-lesson template override**; **reusable personal template library** across courses.
- A field is stored information; a module is its presentation. Changing module location or hiding a module does **not** relocate, erase, or duplicate field values.
- Applying a template to existing content should preview changes and preserve values in fields absent from the new template. Updates to a course default should apply to **new lessons by default**, without silently restructuring existing lessons.
- Reusable custom fields have stable identities. Rich text should be supported selectively rather than forcing every field into an unstructured document.
- Textbook-sourced metadata may have teacher overrides; restoring the source should be deliberate and reversible.
- Focus Mode and version history are desirable follow-on features, not required in the first website demonstration.
- The initial Google Sheets-backed app needs an explicit engineering storage strategy for custom fields/templates; do not assume the current fixed workbook columns already support arbitrary custom schemas.

## 6. Workspace D — Calendar

### Purpose
Answer: **When can this course actually be taught, and what changes when the schedule changes?**

### Layout
- **Monthly grid is the default**, with a **Weekly Agenda toggle** local to Calendar.
- Color-coded information differentiates lessons, assessments, closures, instructional exceptions, flex days and fixed overrides. **Unit color and event type must remain distinguishable**; do not rely on one color alone.
- Selecting a date opens its details and available actions. Selecting a scheduled lesson opens that same Lesson Planning record. Display useful pacing context alongside the calendar.
- Correct month/weekday labels, accessible controls, coherent date math, and obvious navigation between months are required.

### Scheduling semantics
- **Course Sequence** owns lesson order; **Calendar** owns teaching-day availability and date-placement rules. Calendar does not implicitly rewrite lesson order when a date is dragged.
- School closures and full instructional-day blocks make days unavailable for normal automatic lesson placement. Special schedules may leave a day usable; represent this explicitly.
- Ordinary assessment lessons participate in the sequence. A teacher may independently pin a particular assessment to a date.
- Reserved flex days and lesson duration (including multi-day lessons) consume or reserve appropriate instructional capacity. Do **not** equate one lesson record with exactly one instructional day.
- A **fixed override / Pin to Date** is an explicit hard scheduling commitment. Recalculation preserves it unless the teacher explicitly unpins or moves it. A pin that conflicts with a school closure must be resolved; never silently overwrite a closure.
- A **flexible date move** is a soft preference for placement, **not** a fixed override. Store/display it distinctly; honor it if consistent with ordered lessons, available time, and hard constraints. Later schedule recalculations may move it. When the preference cannot be honored, state why. Neither flexible moves nor pins silently reorder the canonical lesson sequence.
- If available dates are insufficient, show conflicts or unscheduled lessons rather than hiding the shortfall. The conflict resolution UI may offer a date change, unpinning, changing lesson order, revising availability, or canceling the proposed action—but must require deliberate teacher approval.

### Change preview (approved across workspaces)
- Before **any materially schedule-changing action** (lesson/unit reorder, date movement, added blocked day, archive affecting dates, pin/unpin affecting other lessons), calculate and show **before → proposed** dates for *all affected records*, counts, fixed commitments, conflicts and any unscheduled work.
- **Confirm** applies atomically when possible; **Cancel** leaves the prior state unchanged. Provide Undo/history in the real app. Routine field edits do not require confirmation.
- Unit Planning defines target days. Planned instructional days, actually scheduled days, available teaching days and pacing variance must be named distinctly. A target-day edit changes the comparison, not the calendar itself.

### Manual date placement — final decision
- **Flexible Move:** preference, recalculable later, no permanent lock.
- **Pin to Date:** explicit protected override; identifiable in the calendar and removable deliberately.
- Both show a preview of downstream changes; unsatisfied constraints cannot be silently forced.

## 7. Navigation and resource policy

- Top-level app workspace navigation has **Course Sequence, Unit Planning, Lesson Planning, Calendar** as the four flagship planning sections.
- Within **Course Sequence**, Table/Board toggle changes only its layout; a unit filter affects both consistently.
- Within **Calendar**, Month/Week toggle changes only calendar presentation.
- Do **not** have a global view toggle that unexpectedly exits Unit Planning, Lesson Planning, Calendar, or Resources. Do **not** show two different selected navigation states for identical layouts.
- **Resources** remain a supporting lesson-context feature for now, with related references visible in Lesson Planning. A standalone Resources workspace may exist later, but should not imply connected files, storage, or integrations in the initial demo. Remove duplicate static panels where they add no value.
- Context should clearly identify the selected course, unit, and lesson and make it easy to return to the previous workspace without losing edit state.

## 8. Public website demonstration — implementation contract

The website exists to **explain the envisioned Course Planner**, not to be a production planning app. The design should be truthful about what works.

### Preserve
- Existing one-page sections: Hero, Product Preview, How It Works, Customization, Focused by Design, Closing/Coming Soon, footer.
- Current dark, refined aesthetic, soft colored units, modular visual grammar, responsive layout, accessible anchor navigation, existing repository/deployment wiring.
- Teacher-centered messaging and explicit **in development / interactive sample** status.

### Correct and demonstrate

| Preview area | Required visible state | Minimum authentic interaction |
| --- | --- | --- |
| Course Sequence | Course-wide compact master table across multiple units, colored unit cards, statuses/types/dates | Filter/all units; select/open lesson; inline sample status or title edit if clearly unsaved; Table/Board within Sequence |
| Unit Planning | Real unit fields: Essential Questions, outcomes, assessments, supports and pacing overview | Select unit; expand/collapse independent editable-looking sections; navigate connected lesson |
| Lesson Planning | Detailed lesson modules, inherited unit EQ, distinct lesson Guiding Question | Select different lessons; expand/collapse modules; show template change concept without loss of sample field content |
| Calendar | **True month grid** including multiple lessons, assessment, closure, instructional exception, protected assignment and flex capacity | Select day; Month/Week local toggle; show a scripted before/after change preview; distinguish flexible move from Pin to Date |
| Customization | Course-level template idea, module arrangements, colors | Small local selection examples; avoid claiming a real template library has been built |

### Sample-data policy
- Choose **one coherent fictional American Government sample course**, with consistent unit and lesson names, counts, planning fields, and dates across every preview. Prefer the **2026–27 school year** over unrelated August/September 2024 dates. Example labels must not imply actual district or professional standards unless verified.
- Keep the fictional curriculum separate from the user's private actual lesson links, school records, and connected Google documents. Do not expose student information or personal resources.
- All interaction states should derive from the same sample data model; avoid independent hard-coded copies for Board/Table/Calendar/Lesson Planning.
- Preview changes are local and disposable unless explicitly implemented otherwise. **Never show a deceptive 'Saved to your course' indicator.** Use visible language such as *Interactive example · Sample changes are not saved*.
- For scheduling, a small deterministic simulation or predefined preview scenario is adequate; it must be internally consistent and clearly labeled. No pretend production scheduling backend, OAuth login, storage integration, or account functionality.

### Site copy priorities
1. Lead with **connected planning**: build a course once; develop units and lessons in linked views; see how they fit on the teaching calendar.
2. Show tangible differentiation: whole-course sequence, unit-level thinking, meaningful lesson authoring, closure-aware scheduling and impact previews.
3. Present layout flexibility and templates as product direction, not a claim that teachers can already persist them.
4. Keep a clear distinction between **working demonstration controls**, **existing spreadsheet prototype**, and **planned web-app capabilities**.
5. Avoid school IT, student data, subscriptions, account features, integrations, file-upload claims, or pricing promises not yet established.

### Responsive and accessibility requirements
- Improve small desktop type used in current demo; keep core lesson titles and controls comfortably legible at native size.
- On mobile, avoid forcing users through enormous stacked lesson details before they can interact with other views; use collapsible modules, a compact navigator, or a focused demo entry point.
- Preserve keyboard focus, semantic buttons, visible selected states, readable contrast, descriptive labels and full keyboard alternatives for critical future reorder actions.
- Do not duplicate the Calendar and Sequence controls in unrelated workspace navigation. Maintain a single clear active state.

## 9. Website acceptance checklist

1. Default landing page and section anchors work at desktop (~1440px) and mobile (~390px); no horizontal overflow or console errors.
2. Course Sequence initially shows all sample units and all sample lessons, **not** one unit's full Lesson Planning detail.
3. Unit filter and All Units update table and board consistently. A selected row opens the correct detailed lesson and carries the same stable sample identity across views.
4. Course Sequence and Lesson Planning have demonstrably different layouts and purposes.
5. Unit Planning displays unit-owned Essential Questions and relevant substantive planning fields. Switching unit changes all unit-owned context consistently.
6. Lesson Planning shows **Unit Essential Question** as inherited context and **Lesson Guiding Question** as lesson-owned text; changing lesson changes the correct content.
7. Calendar defaults to a monthly grid; Week toggle stays inside Calendar; date/day details, assessment, closure, testing exception, flex time and fixed pin are distinguishable.
8. Demonstrated schedule-change preview presents consistent before/after dates and respects any illustrated closure and fixed override. Cancel does not alter sample state; confirm only changes local demo state with explicit disclosure.
9. A flexible move is clearly labeled different from a pinned assignment. Subsequent sample recalculation may shift a flexible placement but not a protected pin.
10. Customization examples are explicit samples; applying an illustrative template does not erase or relabel lesson fields.
11. Resources are plainly illustrative, not falsely clickable downloads or live Google Drive links.
12. Navigation highlight agrees with the central workspace: Course Sequence Table/Board and Calendar Month/Week never unexpectedly change to another workspace.
13. All explanatory sample figures, unit totals, lesson counts, weekday/date labels, and cross-view titles reconcile.
14. No uploads of private lessons, student details, current school documents, or credentials; no change to the canonical workbook or Apps Script.

## 10. Delivery sequence and safeguards

**Pass 1 — Architecture:** Refactor the shared fictional data/state; correct Course Sequence, Unit Planning, Lesson Planning, Calendar, and navigation relationships.

**Pass 2 — User experience:** Readability, responsive mobile demo, appropriate contextual resource surfaces, accessible controls, marketing-copy accuracy.

**Pass 3 — Verification:** Exercise all workspace layouts and meaningful states at desktop/mobile; obtain screenshot capture and interaction evidence; compare against this acceptance checklist.

**Implementation boundary:** A subsequent Codex task can implement the **website demonstration only** inside the existing primary Course Planner landing-page repository. Before approved deployment: inspect existing files, preserve styling and deployment structure, do not touch the live workbook or canonical Apps Script, do not add an authentication/backend service, do not expose private teaching data, and do not commit, push, or deploy without explicit user authorization.

## 11. Explicitly deferred or requiring separate product decisions

These ideas are valuable but have **not** been approved as required first-version deliverables: production-grade persistent rich-text editing, real template libraries and custom-field schema storage, full two-way Google Sheets synchronization, real rescheduling algorithms for every edge case, version-history UI, cross-course resource linking, direct Drive integrations, separate resource-management workspace, admin collaboration, real file attachments, and advanced Focus Mode.

**Next decision after this specification:** Approve the demo scope/interaction depth, then issue a single comprehensive Codex implementation prompt. Review the resulting screenshots and test evidence before any GitHub push or Vercel deployment.
