---
noteId: "ae0f704093bf11f1820369ab5d9dcaf4"
tags: []

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The app is implemented: 4 tabs (复习/新词/词汇/我的) plus non-tab pages for word detail, feedback, and a static help page, matching the mockups in `assets/1*`–`4*` and the spec in `design.md`. The original WeChat CloudBase quickstart demo (`pages/index`, `pages/example`, `components/cloudTipModal`, `envList.js`) has been deleted — it's fully superseded. `cloudfunctions/quickstartFunctions` (the demo's generic CRUD cloud function) was left in place, unused, and is the only cloud function left in the repo — see Cloud usage below for why. The app makes **no `wx.cloud` calls at all** (no `wx.cloud.init` in `app.js`, either).

When extending the app: the word/review/vocab data model (below) is the load-bearing design — read it before changing scheduling or storage behavior, since several pieces depend on invariants that aren't obvious from any single file (e.g. `history` upsert-by-date, `dailyStatus` doing double duty as both session state and calendar log).

**Keep this file updated.** Whenever a bug fix or new feature touches something documented here (data model fields/invariants, sync protocol, architecture, setup steps), add a concise line to the relevant section as part of that change — don't let this file drift out of sync with the code like it did for several commits in a row before this note was added. Pure UI-only fixes with no behavioral/invariant change don't need an entry.

## Data model (`miniprogram/utils/wordStore.js`)

Everything is local-only via `wx.setStorageSync`/`getStorageSync` — there is no cloud sync of word data (dropped to avoid per-user CloudBase costs; see Cloud usage below), so all four tabs work immediately in DevTools with zero cloud configuration, and there's nothing to keep in sync.

- `exportData()`/`importData(json)` are the only bridge to the outside world: `exportData` serializes `{words, dailyStatus}` to a JSON string for the user to copy out (我的 → 数据备份 → 导出数据, via `wx.setClipboardData`); `importData` parses a pasted snapshot and merges it in last-write-wins by `updatedAt` (same merge shape as the old `mergeRemote`, just triggered by paste instead of a network pull) — a stale backup can't clobber newer local data. This is a manual safety net, not automatic backup; nothing calls it unless the user taps the button.

- **`words`** (array): `{ id, word, meanings:[{pos, def}], notes, createdAt, createdDate, stage, nextReviewDate, history:[{date, action}], updatedAt }`.
  - `history` stores **one entry per calendar date**, upserted (not appended) — see `upsertHistory`. The latest action on a given date overwrites that date's entry, so it reads as "what was the outcome of reviewing this word on day X", matching the 词汇 detail page's 复习记录 list. Don't switch this to append-only without updating the detail page render.
  - Scheduling (`miniprogram/utils/review.js`): `REVIEW_INTERVALS = [1,2,4,7,15,30]` days, simplified Ebbinghaus-inspired, clamped at the last stage. Correct → `stage++`; incorrect → `stage = 0`. `nextReviewDate` is only advanced on a *correct* resolution — this is what makes "roll over an unfinished day's words to tomorrow" work for free (no explicit rollover code needed): an overdue word just keeps showing up in `getDueWords()` until it's marked 记对了.
  - `updateWord({id, word, meanings, notes})` (used by the 词汇详情 edit UI) only touches those three fields plus `updatedAt` — it never resets `stage`/`nextReviewDate`/`history`, so correcting a typo or rewriting a definition doesn't disturb the review schedule or the 复习记录 log.
- **`dailyStatus`** (map keyed by `'YYYY-MM-DD'`): `{ date, dueCount, doneCount, updatedAt, order?, queue?, mistakes?, finished? }`. Today's entry does **two jobs at once**: it's the resumable review session (`queue` front = current word; 不记得/记错了 push the id to the back of `queue` and add it to `mistakes`; 记对了 shifts it off) *and* the permanent per-day log the "我的" check-in calendar reads. Past entries drop the session fields and just keep the counts. Don't split these into two stores — the resumability and the calendar history are the same fact.
  - Gap days where the app was never opened are backfilled once per launch (`backfillGapDays`, called from `app.js onLaunch`) using each word's *current* `nextReviewDate` as an approximation of what was due back then — a word resolved between that gap day and today will under-count for that day. Acceptable tradeoff for a personal notebook; don't try to make this exact without a good reason, it'd require replaying `history` day-by-day.
- Vocab tab grouping (`getGroupedVocab(mode)`) groups by `createdDate` into week (Mon–Sun, via `getWeekRange` in `utils/date.js`) / month / year buckets, newest-first, empty buckets simply never created.

## Cloud usage — none; feedback is a mailto, not a backend

There is no account system, no cloud sync of word/dailyStatus data, and — as of the current design — no cloud-backed feedback thread either. 用户反馈 on the "我的" tab (`miniprogram/pages/feedback/`) is a static page showing the developer's email (`xkang.zhang@outlook.com`) with a "复制邮箱" button (`wx.setClipboardData`); the user pastes it into their own mail app to send feedback. This replaced an earlier CloudBase-backed submit/reply thread (`wordApi` cloud function + `miniprogram/utils/cloudSync.js` wrapper, `feedback` DB collection) that required a real CloudBase env ID and a deployed cloud function just to support a low-volume personal-notebook feature — that whole path (the cloud function and `cloudSync.js`) has been deleted; it's recoverable from git history if an in-app feedback thread is wanted again later, but prefer the email approach unless requirements change, since it needs zero cloud setup.

Net effect: the app makes **no `wx.cloud` calls anywhere** — `app.js` has no `wx.cloud.init`, and `cloudfunctions/quickstartFunctions` is the only cloud function left in the repo, inert and unused (see Architecture below).

## Architecture (WeChat Mini Program)

- `miniprogram/custom-tab-bar/` — custom tab bar (`app.json` sets `tabBar.custom: true`) rendering glyphs (↺ ＋ ≡ 👤) instead of image icons, to match the mockups without needing new art assets. Each tab page calls `this.getTabBar().setActive(path)` in `onShow`.
- `miniprogram/utils/` — `date.js` (pure date helpers), `review.js` (scheduling), `wordStore.js` (local CRUD + session + calendar + export/import). Pages call into these rather than touching `wx.getStorageSync` directly.
- `miniprogram/pages/vocab-detail/`, `miniprogram/pages/feedback/`, and `miniprogram/pages/help/` are plain (non-tab) pages reached via `wx.navigateTo`, not part of the custom tab bar.
  - `vocab-detail`'s root deliberately does *not* gate on `wx:if="{{word}}"` — `data.word` defaults to an empty-but-truthy stub so the page's node tree is created once at mount and onLoad's `setData` only has to patch text into it. Wrapping the whole page in a single top-level `wx:if` (as it originally did) forces the render layer to create the entire subtree right as the `navigateTo` slide-in lands, which shows up as "nav bar appears instantly, content pops in late." Don't reintroduce a root-level `wx:if` here without re-checking that tradeoff.
  - `feedback/index.js` is a static page with no data dependencies beyond a hardcoded email constant — see Cloud usage above.
  - `help/index.wxml` is hand-authored static markup mirroring `assets/使用说明.md` (WeChat has no built-in markdown renderer, so there's no single source of truth parsed at runtime) — whenever one changes, update the other by hand.
- `cloudfunctions/quickstartFunctions/` is inert leftover template code from the original quickstart, not called from anywhere — the app has no wired-up cloud function at all (see Cloud usage above).
- `project.config.json` / `project.private.config.json` — WeChat DevTools project config (appid, compile settings). `project.private.config.json` holds machine-local overrides.
- `.notebook/` — scratch/tooling directory, not part of the shipped mini-program.

## Development workflow

There is no build tool, test runner, package.json, or linter configured at the project root — this is developed and run through **WeChat DevTools** (微信开发者工具), which compiles/previews/uploads the mini-program directly from `miniprogram/` and `cloudfunctions/`. There are no CLI commands for build/lint/test in this repo; changes are verified by opening the project in WeChat DevTools and using its simulator/preview.

Useful manual checks in the simulator: add a word via 新词 and confirm it appears in 词汇 under the right week/month/year bucket; a newly added word should *not* appear in 复习 until `nextReviewDate` (1 day out by default — temporarily shrink `REVIEW_INTERVALS[0]` or change the simulator's system date to test sooner); run through 记得→记对了/记错了 and 不记得→下一个 to confirm requeueing and the done-screen stats; kill and reopen the simulator mid-session to confirm the review session resumes instead of restarting; on 我的, tap 导出数据 then clear local storage (or switch simulator profile) and 导入数据 with the copied text to confirm the backup round-trips; on 我的 → 用户反馈, confirm the page shows the email and tapping 复制邮箱 puts it on the clipboard (no cloud env or deployment needed for this at all now).
