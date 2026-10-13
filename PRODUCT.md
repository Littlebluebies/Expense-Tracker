# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, both confirmed:

- **The owner, daily.** A Thai individual logging their own spending on a phone, in short bursts right after paying (lunch, coffee, a fare, groceries), then opening the month view near month-end to see where the money went and whether the budget held.
- **Portfolio visitors.** Reviewers (for example HR or other developers) who arrive through the README's live-demo link, register a throwaway account, and walk the README's five-minute "try this" sequence. They judge the product and its craft within the first screens.

## Product Purpose

A monthly income and expense log with budgets. It exists so one person can record money in seconds and see, for any month, the balance, how the overall budget and per-category budgets are holding, what changed versus last month, and which fixed monthly items were posted automatically. Success: logging an item takes a few taps, and the month's state is readable at a glance without digging.

## Positioning

A personal-scale, Thai-language money log built around the month as the unit: per-month budgets with a carry-over default, per-category limits, recurring items auto-posted on their day (with catch-up up to 12 months), like-for-like comparison against the same span of the previous month, quick-add chips learned from repeated entries, undo on every add and delete, and full offline use as an installable PWA. Free, no ads, personal project, not a commercial service.

## Operating Context

- Mostly phone-portrait use, standalone PWA from the home screen; also desktop browsers.
- Used in moments of payment, often one-handed; offline is normal (airplane mode, poor signal), with sync on reconnect.
- Month-end review is a slower, read-heavy session: balance, budget bars, category breakdown, six-month trend, transaction search, CSV export to Excel or Google Sheets.
- Portfolio visitors follow README.md's step table, which names UI elements by label (budget box, add-item box, quick-add chip, undo in the toast, month compare, category budgets, recurring items, theme toggle, settings).

## Capabilities and Constraints

- Routes: `/` login (with password-reset dialog), `/register`, `/dashboard`, `/settings`.
- Dashboard: month switcher (no future months), offline and unverified-email notices, month balance (income minus expense), month-vs-previous comparison, monthly budget (per-month or default, daily allowance for the current month), add/edit transaction form with quick-add chips, category budgets, recurring items (add, edit, pause, delete), category doughnut, six-month bar chart with budget line (tap a bar to jump to that month), grouped transaction list with filter, search, edit, delete, CSV export.
- Settings: display name, email verification, change password, export all CSV, sign out, delete account (password plus typed confirmation "ลบบัญชี", online only).
- Toast at the bottom with an undo action on add and delete.
- Currency: Thai baht only. All UI copy is Thai; dates via `th-TH` locale.
- Stack: Create React App, React 19, React Router 7, Bootstrap 5 (must stay), Chart.js via react-chartjs-2, Firebase Auth and Firestore with persistent local cache, App Check.
- Content-Security-Policy in `vercel.json` allows styles from `fonts.googleapis.com` and fonts from `fonts.gstatic.com` only (plus self).
- Vercel builds with `CI=true`; ESLint warnings fail the build.
- README.md documents UI labels for the try-it guide; renaming those labels means updating the README too.

## Brand Commitments

- Name: "บันทึกรายรับ-รายจ่าย", short name "รายจ่าย". Keep.
- Light and dark modes, user-toggleable and remembered. Keep.
- Bootstrap stays as the base framework.
- The owner judged the previous look as generic AI output: emoji everywhere, a long stack of identical white rounded cards, stock Bootstrap components, and a blue-to-violet gradient balance card. None of these are commitments; treat them as anti-references.

## Evidence on Hand

- Real feature set and copy in the codebase and README.md.
- Live demo: https://expense-tracker-seven-red-52.vercel.app/
- No testimonials, user counts, or press. Do not invent any.
- No logo or brand assets beyond the default CRA icons in `public/`.

## Product Principles

1. Logging is the hot path: the fewest taps from opening the app to a saved item, offline included.
2. The month is the unit. Every number on screen answers a question about the selected month.
3. Never rely on color alone for status; pair it with text or a sign.
4. Every destructive or accidental action is reversible or explicitly confirmed.
5. Plain Thai, written for a person, not a system.

## Accessibility & Inclusion

Thai script must render cleanly at small sizes (tone marks and vowels above and below the line need line-height room). Status already pairs color with text and symbols; keep that. Touch targets sized for one-handed phone use.
