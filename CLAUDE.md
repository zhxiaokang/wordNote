---
noteId: "ae0f704093bf11f1820369ab5d9dcaf4"
tags: []

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The app is implemented: 4 tabs (复习/新词/词汇/我的) plus a non-tab word-detail page and a feedback page, matching the mockups in `assets/1*`–`4*` and the spec in `design.md`. The original WeChat CloudBase quickstart demo (`pages/index`, `pages/example`, `components/cloudTipModal`, `envList.js`) has been deleted — it's fully superseded. `cloudfunctions/quickstartFunctions` (the demo's generic CRUD cloud function) was left in place, unused; only `cloudfunctions/wordApi` is wired to the app.

When extending the app: the word/review/vocab data model and its local-first-then-sync architecture (below) is the load-bearing design — read it before changing scheduling, storage, or sync behavior, since several pieces depend on invariants that aren't obvious from any single file (e.g. `history` upsert-by-date, `dailyStatus` doing double duty as both session state and calendar log).

## Data model (`miniprogram/utils/wordStore.js`)

Everything is local-first via `wx.setStorageSync`/`getStorageSync`; cloud sync (below) is a mirror, not the source of truth, so all three word-related tabs work immediately in DevTools with zero cloud configuration.

- **`words`** (array): `{ id, word, meanings:[{pos, def}], notes, createdAt, createdDate, stage, nextReviewDate, history:[{date, action}], updatedAt }`.
  - `history` stores **one entry per calendar date**, upserted (not appended) — see `upsertHistory`. The latest action on a given date overwrites that date's entry, so it reads as "what was the outcome of reviewing this word on day X", matching the 词汇 detail page's 复习记录 list. Don't switch this to append-only without updating the detail page render.
  - Scheduling (`miniprogram/utils/review.js`): `REVIEW_INTERVALS = [1,2,4,7,15,30]` days, simplified Ebbinghaus-inspired, clamped at the last stage. Correct → `stage++`; incorrect → `stage = 0`. `nextReviewDate` is only advanced on a *correct* resolution — this is what makes "roll over an unfinished day's words to tomorrow" work for free (no explicit rollover code needed): an overdue word just keeps showing up in `getDueWords()` until it's marked 记对了.
- **`dailyStatus`** (map keyed by `'YYYY-MM-DD'`): `{ date, dueCount, doneCount, updatedAt, order?, queue?, mistakes?, finished? }`. Today's entry does **two jobs at once**: it's the resumable review session (`queue` front = current word; 不记得/记错了 push the id to the back of `queue` and add it to `mistakes`; 记对了 shifts it off) *and* the permanent per-day log the "我的" check-in calendar reads. Past entries drop the session fields and just keep the counts. Don't split these into two stores — the resumability and the calendar history are the same fact.
  - Gap days where the app was never opened are backfilled once per launch (`backfillGapDays`, called from `app.js onLaunch`) using each word's *current* `nextReviewDate` as an approximation of what was due back then — a word resolved between that gap day and today will under-count for that day. Acceptable tradeoff for a personal notebook; don't try to make this exact without a good reason, it'd require replaying `history` day-by-day.
- Vocab tab grouping (`getGroupedVocab(mode)`) groups by `createdDate` into week (Mon–Sun, via `getWeekRange` in `utils/date.js`) / month / year buckets, newest-first, empty buckets simply never created.

## Cloud sync — opt-in, gated behind login (`miniprogram/utils/cloudSync.js` + `cloudfunctions/wordApi`)

Sync is **not** always-on CloudBase; it only activates once the user taps 登录 on the "我的" tab. `wordStore.setChangeListener()` is how `cloudSync` hears about local mutations without `wordStore` knowing sync exists — keep that direction of dependency if you touch either file.

- Cloud function `wordApi` (same dispatch-by-`event.type` pattern as `quickstartFunctions`): `login`, `syncPush`, `syncPull`, `submitFeedback`, `getFeedback`. It always reads `cloud.getWXContext().OPENID` server-side and stamps/filters by that — never trusts a client-sent openid.
- Sync protocol is last-write-wins by `updatedAt`, scoped per-user by `_openid`: `syncPush` upserts matched by `{_openid, id}` (words) or `{_openid, date}` (dailyStatus), only overwriting if the incoming doc is newer. `syncPull(sinceTs)` returns docs with `updatedAt > sinceTs`; `sinceTs: 0` (used on first login / new device) pulls everything.
- Failure handling is deliberately silent per `design.md` ("失败无需报错，稍后再试即可"): every push after a local mutation is fire-and-forget with errors swallowed. There's no persistent retry queue — instead, every app launch while logged in runs one `syncNow()` that pulls anything new, merges it (`wordStore.mergeRemote`), and re-pushes anything locally newer than `lastSyncAt`, which naturally retries whatever failed last time.
- `feedback` collection is cloud-only (no offline cache beyond a page-local list); replies are written directly into the DB by the developer — there's no admin UI in this app, the client only ever reads `reply`/`repliedAt`.

## Setup required for cloud features

`miniprogram/app.js`'s `globalData.env` is still blank — 复习/新词/词汇 don't need it, but 登录/云同步/反馈 will fail silently (or throw on `wx.cloud.callFunction`) until you set a real CloudBase env ID there and deploy `cloudfunctions/wordApi` (and `quickstartFunctions`, if you want to keep it around) via WeChat DevTools or `uploadCloudFunction.sh` with real paths filled in. No login is required to use the cloud function for anonymous actions — but this app never calls it without `auth.loggedIn`, so nothing happens until the user taps 登录.

## Architecture (WeChat Mini Program + CloudBase)

- `miniprogram/custom-tab-bar/` — custom tab bar (`app.json` sets `tabBar.custom: true`) rendering glyphs (↺ ＋ ≡ 👤) instead of image icons, to match the mockups without needing new art assets. Each tab page calls `this.getTabBar().setActive(path)` in `onShow`.
- `miniprogram/utils/` — `date.js` (pure date helpers), `review.js` (scheduling), `wordStore.js` (local CRUD + session + calendar), `cloudSync.js` (auth + push/pull + feedback). Pages call into these rather than touching `wx.getStorageSync`/`wx.cloud` directly.
- `miniprogram/pages/vocab-detail/` and `miniprogram/pages/feedback/` are plain (non-tab) pages reached via `wx.navigateTo`, not part of the custom tab bar.
- `cloudfunctions/wordApi/` — the real backend for this app (see Cloud sync above). `cloudfunctions/quickstartFunctions/` is inert leftover template code, not called from anywhere.
- `project.config.json` / `project.private.config.json` — WeChat DevTools project config (appid, compile settings). `project.private.config.json` holds machine-local overrides.
- `.notebook/` — scratch/tooling directory, not part of the shipped mini-program.

## Development workflow

There is no build tool, test runner, package.json, or linter configured at the project root — this is developed and run through **WeChat DevTools** (微信开发者工具), which compiles/previews/uploads the mini-program directly from `miniprogram/` and `cloudfunctions/`. There are no CLI commands for build/lint/test in this repo; changes are verified by opening the project in WeChat DevTools and using its simulator/preview.

Useful manual checks in the simulator: add a word via 新词 and confirm it appears in 词汇 under the right week/month/year bucket; a newly added word should *not* appear in 复习 until `nextReviewDate` (1 day out by default — temporarily shrink `REVIEW_INTERVALS[0]` or change the simulator's system date to test sooner); run through 记得→记对了/记错了 and 不记得→下一个 to confirm requeueing and the done-screen stats; kill and reopen the simulator mid-session to confirm the review session resumes instead of restarting; after setting a real `env` and deploying `wordApi`, test 登录 → check the 我的 calendar/feedback populate, then clear local storage and log in again to confirm cloud data comes back (simulates a new device).
