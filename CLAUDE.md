---
noteId: "ae0f704093bf11f1820369ab5d9dcaf4"
tags: []

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The app is implemented: 4 tabs (复习/新词/词汇/我的) plus a non-tab word-detail page and a feedback page, matching the mockups in `assets/1*`–`4*` and the spec in `design.md`. The original WeChat CloudBase quickstart demo (`pages/index`, `pages/example`, `components/cloudTipModal`, `envList.js`) has been deleted — it's fully superseded. `cloudfunctions/quickstartFunctions` (the demo's generic CRUD cloud function) was left in place, unused; only `cloudfunctions/wordApi` is wired to the app.

When extending the app: the word/review/vocab data model (below) is the load-bearing design — read it before changing scheduling or storage behavior, since several pieces depend on invariants that aren't obvious from any single file (e.g. `history` upsert-by-date, `dailyStatus` doing double duty as both session state and calendar log).

**Keep this file updated.** Whenever a bug fix or new feature touches something documented here (data model fields/invariants, sync protocol, architecture, setup steps), add a concise line to the relevant section as part of that change — don't let this file drift out of sync with the code like it did for several commits in a row before this note was added. Pure UI-only fixes with no behavioral/invariant change don't need an entry.

## Data model (`miniprogram/utils/wordStore.js`)

Everything is local-only via `wx.setStorageSync`/`getStorageSync` — there is no cloud sync of word data (dropped to avoid per-user CloudBase costs; see Cloud usage below), so all three word-related tabs work immediately in DevTools with zero cloud configuration, and there's nothing to keep in sync.

- `exportData()`/`importData(json)` are the only bridge to the outside world: `exportData` serializes `{words, dailyStatus}` to a JSON string for the user to copy out (我的 → 数据备份 → 导出数据, via `wx.setClipboardData`); `importData` parses a pasted snapshot and merges it in last-write-wins by `updatedAt` (same merge shape as the old `mergeRemote`, just triggered by paste instead of a network pull) — a stale backup can't clobber newer local data. This is a manual safety net, not automatic backup; nothing calls it unless the user taps the button.

- **`words`** (array): `{ id, word, meanings:[{pos, def}], notes, createdAt, createdDate, stage, nextReviewDate, history:[{date, action}], updatedAt }`.
  - `history` stores **one entry per calendar date**, upserted (not appended) — see `upsertHistory`. The latest action on a given date overwrites that date's entry, so it reads as "what was the outcome of reviewing this word on day X", matching the 词汇 detail page's 复习记录 list. Don't switch this to append-only without updating the detail page render.
  - Scheduling (`miniprogram/utils/review.js`): `REVIEW_INTERVALS = [1,2,4,7,15,30]` days, simplified Ebbinghaus-inspired, clamped at the last stage. Correct → `stage++`; incorrect → `stage = 0`. `nextReviewDate` is only advanced on a *correct* resolution — this is what makes "roll over an unfinished day's words to tomorrow" work for free (no explicit rollover code needed): an overdue word just keeps showing up in `getDueWords()` until it's marked 记对了.
  - `updateWord({id, word, meanings, notes})` (used by the 词汇详情 edit UI) only touches those three fields plus `updatedAt` — it never resets `stage`/`nextReviewDate`/`history`, so correcting a typo or rewriting a definition doesn't disturb the review schedule or the 复习记录 log.
- **`dailyStatus`** (map keyed by `'YYYY-MM-DD'`): `{ date, dueCount, doneCount, updatedAt, order?, queue?, mistakes?, finished? }`. Today's entry does **two jobs at once**: it's the resumable review session (`queue` front = current word; 不记得/记错了 push the id to the back of `queue` and add it to `mistakes`; 记对了 shifts it off) *and* the permanent per-day log the "我的" check-in calendar reads. Past entries drop the session fields and just keep the counts. Don't split these into two stores — the resumability and the calendar history are the same fact.
  - Gap days where the app was never opened are backfilled once per launch (`backfillGapDays`, called from `app.js onLaunch`) using each word's *current* `nextReviewDate` as an approximation of what was due back then — a word resolved between that gap day and today will under-count for that day. Acceptable tradeoff for a personal notebook; don't try to make this exact without a good reason, it'd require replaying `history` day-by-day.
- Vocab tab grouping (`getGroupedVocab(mode)`) groups by `createdDate` into week (Mon–Sun, via `getWeekRange` in `utils/date.js`) / month / year buckets, newest-first, empty buckets simply never created.

## Cloud usage — feedback only, no login (`miniprogram/utils/cloudSync.js` + `cloudfunctions/wordApi`)

There is no account system and no cloud sync of word/dailyStatus data — that was cut deliberately to avoid per-user CloudBase storage/DB costs (a personal-notebook app doesn't need it, and it made "我的" data non-portable across devices anyway; see the export/import note above for the replacement). The only thing that still touches the cloud is 用户反馈 on the "我的" tab, and it needs no login step: `wordApi` reads `cloud.getWXContext().OPENID` server-side on every call — WeChat attaches this automatically to any `wx.cloud.callFunction`, so a feedback thread is scoped to the user without ever asking for their profile.

- Cloud function `wordApi` (same dispatch-by-`event.type` pattern as `quickstartFunctions`, now trimmed to two cases): `submitFeedback`, `getFeedback`. It always reads `OPENID` server-side and stamps/filters by that — never trusts a client-sent openid.
- `feedback` collection is cloud-only (no offline cache beyond a page-local list); replies are written directly into the DB by the developer — there's no admin UI in this app, the client only ever reads `reply`/`repliedAt`.
- If you're tempted to re-add account-based word sync later: the old design (last-write-wins by `updatedAt`, `{_openid, id}`/`{_openid, date}` upserts, `wordStore.setChangeListener` hook) is recoverable from git history (see the commit that removed it) — re-introducing it means accepting ongoing CloudBase DB cost, which is exactly what this cut was meant to avoid.

## Setup required for cloud features

`miniprogram/app.js`'s `globalData.env` is still blank — 复习/新词/词汇/我的的数据备份 don't need it (all local), but 用户反馈 will fail silently (or throw on `wx.cloud.callFunction`) until you set a real CloudBase env ID there and deploy `cloudfunctions/wordApi` (and `quickstartFunctions`, if you want to keep it around) via WeChat DevTools or `uploadCloudFunction.sh` with real paths filled in. Feedback's CloudBase usage is low-volume enough to stay within the free tier for a personal notebook app.

## Architecture (WeChat Mini Program + CloudBase)

- `miniprogram/custom-tab-bar/` — custom tab bar (`app.json` sets `tabBar.custom: true`) rendering glyphs (↺ ＋ ≡ 👤) instead of image icons, to match the mockups without needing new art assets. Each tab page calls `this.getTabBar().setActive(path)` in `onShow`.
- `miniprogram/utils/` — `date.js` (pure date helpers), `review.js` (scheduling), `wordStore.js` (local CRUD + session + calendar + export/import), `cloudSync.js` (thin `wordApi` wrapper for feedback only). Pages call into these rather than touching `wx.getStorageSync`/`wx.cloud` directly.
- `miniprogram/pages/vocab-detail/` and `miniprogram/pages/feedback/` are plain (non-tab) pages reached via `wx.navigateTo`, not part of the custom tab bar.
  - `vocab-detail`'s root deliberately does *not* gate on `wx:if="{{word}}"` — `data.word` defaults to an empty-but-truthy stub so the page's node tree is created once at mount and onLoad's `setData` only has to patch text into it. Wrapping the whole page in a single top-level `wx:if` (as it originally did) forces the render layer to create the entire subtree right as the `navigateTo` slide-in lands, which shows up as "nav bar appears instantly, content pops in late." Don't reintroduce a root-level `wx:if` here without re-checking that tradeoff.
- `cloudfunctions/wordApi/` — the real backend for this app, now feedback-only (see Cloud usage above). `cloudfunctions/quickstartFunctions/` is inert leftover template code, not called from anywhere.
- `project.config.json` / `project.private.config.json` — WeChat DevTools project config (appid, compile settings). `project.private.config.json` holds machine-local overrides.
- `.notebook/` — scratch/tooling directory, not part of the shipped mini-program.

## Development workflow

There is no build tool, test runner, package.json, or linter configured at the project root — this is developed and run through **WeChat DevTools** (微信开发者工具), which compiles/previews/uploads the mini-program directly from `miniprogram/` and `cloudfunctions/`. There are no CLI commands for build/lint/test in this repo; changes are verified by opening the project in WeChat DevTools and using its simulator/preview.

Useful manual checks in the simulator: add a word via 新词 and confirm it appears in 词汇 under the right week/month/year bucket; a newly added word should *not* appear in 复习 until `nextReviewDate` (1 day out by default — temporarily shrink `REVIEW_INTERVALS[0]` or change the simulator's system date to test sooner); run through 记得→记对了/记错了 and 不记得→下一个 to confirm requeueing and the done-screen stats; kill and reopen the simulator mid-session to confirm the review session resumes instead of restarting; on 我的, tap 导出数据 then clear local storage (or switch simulator profile) and 导入数据 with the copied text to confirm the backup round-trips; after setting a real `env` and deploying `wordApi`, test 用户反馈 (submit without any login step, then confirm a `reply` written directly into the `feedback` collection shows up on next open).
