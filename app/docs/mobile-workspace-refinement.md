# Mobile workspace refinement

Main planning content uses a consistent 16px mobile inset. The sticky tab toolbar
remains edge aligned independently. Narrow screens with a coarse primary pointer
use native horizontal tab scrolling: all tabs remain rendered, normally 180px wide
and capped at the strip width on the smallest screens. Active tabs are revealed
inside the strip without scrolling the editor or document. Long names retain
ellipsis; Open Tabs provides complete names and keyboard access.

Desktop and narrow fine-pointer layouts retain DEC-102 compression. No gesture
handlers are installed on the workspace, calendar or tables. Tab histories, drafts
and save authority are unchanged; no persistence is added.

Synthetic coverage includes 320/390/400px touch contexts and 1440px desktop, actual
Chromium touch input, tapping revealed tabs, close target geometry, focus outlines,
Open Tabs and visible sidebar navigation. Physical-device acceptance remains a
separate review gate. The historical PR #21 mobile navigation timeout remains an
unresolved observation; retained evidence in the previous worktree is preserved.
