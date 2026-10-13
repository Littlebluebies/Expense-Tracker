---
version: 1
slug: "src-pages-dashboard-js"
primary_target: "src/pages/Dashboard.js"
related_targets: ["src/pages/Login.js","src/pages/Register.js","src/pages/Settings.js"]
---

# Surface brief: app shell (Dashboard, Login, Register, Settings)

Scope: every authenticated and auth route; visitor mode Operate. Audience: the owner logging on a phone right after paying, plus portfolio reviewers walking README's try-it table. Layout may be restructured; every feature stays. Bootstrap stays as the base; light and dark both ship.

## Direction contract

THESIS: Money looks like money. The five Thai banknote inks are the palette, each with one job, and today's allowance is counted out in notes. Refuses the fintech default: identical white rounded cards stacked on grey, a gradient balance card, emoji headers, stock Bootstrap chrome.

OWN-WORLD: Cool fibre-paper ground, deep 20-baht green header band with faint guilloché linework. Ink jobs: 20 green = shell, primary action, income; 100 red = over budget and destructive; 1000 khaki-gold = near limit; 50 blue and 500 purple only in data and denomination chips. Sections separated by hairline rules on paper, not cards. Engraved-serif tabular numerals for money at three fixed sizes (raise from challenger-emigre); one right-aligned numeric column everywhere (raise from challenger-ikeda); authored line icons, no emoji in chrome. Dark mode is the same notes at night: ink-green black ground, inks lifted.

STORY: Open, read the month balance, today's allowance in notes, budget health; log in two taps from a quick chip or the docked add button; scan the day-grouped ledger. Month-end: ranked categories (raise from challenger-goods), six-month bars where the chosen month burns in full ink and others sit in tint (raise from challenger-transit), comparison, recurring.

FIRST VIEWPORT: Phone: green band with wordmark, theme and settings icon buttons, month switcher, balance at display size, income and expense pair. On paper below: เงินวันนี้ with fanned note chips, then the budget meter. Docked bottom bar: quick chips plus primary "+ จดรายการ" opening the add sheet. Desktop: band becomes a sticky left column; ledger centre; analysis right; every module on one column grid (raise from challenger-crouwel).

FORM: Thai banknote inks, position 5 of the ordered list, seed key eb8d3492.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
