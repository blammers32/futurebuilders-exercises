# Agents

This repo is the MIT FutureBuilders classroom. Exercises are git submodules under `exercises/`. The human-facing steps are in `README.md`. Follow this file when adding or changing one.

## What you may change

- A new exercise lives in its own repo and is added under `exercises/<id>`.
- Register it by appending its `exercise` export in `src/lib/catalog.ts`.
- A live model can be added to the allowlist in `server/openrouter.mjs`.

Leave the desk, the sync adapters, the publish controls, and the shared frame alone unless the task is about those. Do not rename stored ids. The progress key is `exerciseId__levelId__slideId`, and released levels are a comma-separated list of level ids.

## Contract

Export `exercise` from `src/index.tsx` and import `./styles.css` there. Match the existing exercises. The classroom imports that file from `src/lib/catalog.ts`.

```ts
export const exercise = {
  id: 'waves',
  title: 'Short title',
  kicker: 'Exercise',
  summary: 'One sentence on the landing page.',
  minutes: 30,
  levels: [
    { id: 'crest', title: 'The crest', blurb: 'Hit the line twice.', Component: Crest },
  ],
}
```

A level is one activity, not a lecture. The screen is the task, a visible score, and a goal. Almost no prose: many students are learning English. `blurb` is the mission, shown big under the title, in eight words or fewer. `steps` is an optional list of two or three numbered instructions shown under it (short words, one action each, like "Press Send."). Label the controls on screen with the same numbers. When the level passes, the classroom shows a "Level complete" bar with a button to the next level. Ids are lowercase and stable. No underscores. No commas in a level id.

Each level component takes `{ onComplete, completed }`.

- Call `onComplete({ score: 100, detail })` only when the goal is met. `score > 0` unlocks the next level. `score: 0` does not.
- The desk keeps the best pass. `detail` stays under 400 characters.
- Call `onComplete` from a handler. Never during render.
- The classroom draws the level tabs and locks them in order. The level does not draw that chrome.
- The desk lists every exercise. Publish opens that one exercise at level 1 and closes review. Unpublish freezes every screen. Open for review can be on for several exercises at once; those exercises have every tab unlocked, so students can come back after class.

## Files

```text
../<id>/
  .gitignore
  README.md
  package.json          # name futurebuilders-<id>, private, type module, peerDependencies react
  src/index.tsx
  src/types.ts          # copy SlideProps; do not import from classroom/src
  src/styles.css        # every class prefixed with the exercise id
```

Copy `SlideProps` into the exercise. Do not import from `../../src` or `classroom/src`. The classroom `tsconfig.json` already includes `exercises` and is strict: no unused locals or parameters.

Dependencies come from the classroom `package.json`. Add a new one there and as a peer dependency of the exercise. Prefer none.

## Style and audience

High school, about ages 14 to 18. Graph paper, Fraunces headings, Outfit body, IBM Plex Mono labels. Use the colors already on `:root`. Build the screen from the shared `fb-` classes in `classroom/src/styles.css`: `fb-play` (the column), `fb-pips` (progress dots), `fb-big` (the main input), `fb-stamp yes|no` (the result), `fb-blocks` (token chips), `fb-card`, `fb-split`, `fb-num`, `fb-label`, `fb-note`, `fb-model`, `fb-bar`, `fb-bad`. One big input, one live visual, one stamp. Results update as students type; avoid a Send button. Prefix any extra classes (`tok-`, `pred-`, `cost-`, or `<id>-`). The shared `button` rule is white with ink text, so a filled button sets both `background` and `color`.

Say when a diagram is a teaching model. Do not present it as the production system. Do not use the MIT logo. This is not an official MIT site. The header copy stays “MIT FutureBuilders” and “Interactive Exercises”.

## Models

`fetch(API)`, with `const API = import.meta.env.VITE_API_URL || '/api/openrouter'` so the standalone site (`npm run build:site`) can point at a proxy on another host. Never read or ship `OPENROUTER_API_KEY`, and never use a `VITE_` name for it.

- `GET` returns `{ configured, models }`.
- `POST` body is `{ model, messages, maxTokens, temperature, logprobs, topLogprobs }`.
- The response is `{ text, firstToken, lifted, model, usage, logprobs }`.
- `messages` is 1 to 24 items. Roles are `system`, `user`, or `assistant`. Each content string is 1 to 6000 characters.
- Completion tokens are capped at 400. Some providers reject a max under 16. The server retries at 16 and sets `lifted: true`. Grade only the tokens the slide asked for.
- `logprobs: true` only for a model marked `logprobs: true` in `server/openrouter.mjs`.
- When `configured` is false, show that the host has no key and disable the run control.

## Git

The exercise repo is a sibling, like `../tokenization`. Commit it first. From `classroom`:

```bash
git -c protocol.file.allow=always submodule add ../<id> exercises/<id>
```

That `-c` is for a local folder and must not be written into git config. Then add the import in `src/lib/catalog.ts` and commit the pointer plus that edit.

Later changes are committed inside `exercises/<id>`, then the classroom commit updates the submodule pointer. Do not copy the exercise files in a second time outside the submodule.

Before a Netlify build that clones this repo, point the submodule at a real remote with `git submodule set-url` and commit `.gitmodules`. A local `netlify deploy --build` uses the checkout already on disk.

## Done means checked

From `classroom`, `npx tsc --noEmit` passes. Then, in the browser at the dev server:

- the landing page lists the exercise
- an instructor can select it, release a level, and publish
- a student lesson stays seen after refresh
- a failed challenge does not increase the roster count, and a passed one does
- unpublish shows the hold screen
- a phone-width window does not overflow sideways

`/present/<code>` opens every level and does not write scores. Use it to read slides. Use a student tab to test scoring.
