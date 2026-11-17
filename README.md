# FutureBuilders classroom

Instructor desk and student screens for an MIT RAISE FutureBuilders session. Publish an exercise when the class should work. Unpublish when you want the room back. Publish again at the end so students can walk the slides on their own.

This is a teaching tool for those sessions. It is not an official MIT site.

## Run it

```bash
cd classroom
npm install
cp .env.example .env
npm run dev
```

Open the desk, create a demo sign-in, and open a room. The class code works across tabs on this computer. A second tab can join as a student.

Demo sync uses this browser only. Add Firebase before a real class on separate laptops.

## OpenRouter

The token-budget bench and the next-token bars call OpenRouter through the server. Put the key in `.env` or in the Netlify environment:

```
OPENROUTER_API_KEY=...
```

Do not prefix it with `VITE_`. The browser never sees the key. The server only allows a short list of models and caps a reply at 400 tokens.

## Firebase, for a room that leaves this computer

1. Create a Firebase project with Authentication (email/password) and Realtime Database.
2. Fill in the `VITE_FIREBASE_*` values in `.env`.
3. Publish `database.rules.json` as the Realtime Database rules.

Instructors sign in with email. Students only need the class code and a name. Anyone who knows the code can write their own progress row. The code is the lock, so read it aloud instead of posting it publicly.

## Deploy to Netlify

Both exercises are compiled into this one site. Netlify does not host them separately. `netlify.toml` builds with `npm run build`, publishes `dist`, sends `/api/openrouter` to the function, and already has the single-page fallback.

Set these in the Netlify site environment before the first production deploy:

| Name | When it is read | What happens if it is missing |
|---|---|---|
| `NODE_VERSION` = `22` | Build | Vite 7 fails on Netlify’s older default Node. |
| `OPENROUTER_API_KEY` | Each model request | The site loads. Model slides say the host has no key. Do not prefix this with `VITE_`. |
| `VITE_FIREBASE_*` | Build, baked into the browser bundle | Each browser keeps its own demo room. Students on other laptops will not see the desk. |

For a real class, create the Firebase project (email/password auth and Realtime Database), publish `database.rules.json`, set the `VITE_FIREBASE_*` variables, then deploy again. Changing those variables requires a new build.

### From this computer

The exercise folders are already inside `exercises/`, so a local build includes them. Submodule URLs do not matter.

```bash
cd classroom
npx netlify login
npx netlify init
npx netlify deploy --build --prod
```

Accept the build command and publish directory from `netlify.toml` when `netlify init` asks.

### From a git push

This path rebuilds when the classroom repo changes. It needs real remotes. The URLs in `.gitmodules` are local (`../tokenization`, `../prediction`), and those paths do not exist on Netlify’s builders.

1. Push `tokenization` and `prediction` first, then push `classroom`.
2. Point the submodules at those remotes and commit:

```bash
git submodule set-url exercises/tokenization https://github.com/YOU/tokenization.git
git submodule set-url exercises/prediction https://github.com/YOU/prediction.git
git add .gitmodules
git commit -m "Point exercise submodules at their remotes."
git push
```

3. In Netlify, create a site from the classroom repo. The git connection has to be allowed to read the exercise repos too. Public repos clone on their own. Private ones need the Netlify app granted access to all three.
4. Set the environment variables above, then deploy.

Do the same `git submodule set-url` step for any exercise you add later. A new lesson is not on the hosted site until its repo is pushed and the classroom commit that records the new pointer is deployed.

## Standalone site (no Firebase, no class code)

`npm run build:site` builds only the exercises into `dist-site/`. It has a home page that lists every exercise. All levels are open, and progress is saved in the visitor's browser. It has no instructor desk, no sign-in, and no Firebase. Paths are relative and routes use `#/`, so the folder works on any static host, at the root or in a subfolder (for example `yoursite.com/exercises/`). Upload the contents of `dist-site/`.

The exercises still need the model proxy, because the OpenRouter key must stay on a server:

- **Same Netlify site:** deploy this repo to Netlify as described above. The site then answers at `/api/openrouter` and nothing else is needed.
- **Other host:** keep a Netlify deploy of this repo only for the function. Build with its address, then upload `dist-site/`:

  ```bash
  VITE_API_URL=https://your-proxy.netlify.app/api/openrouter npm run build:site
  ```

  On that Netlify site, set `ALLOWED_ORIGIN` to your website (for example `https://yoursite.com`). Without it, any website can use the proxy, and so spend your key. Put a spending limit on the OpenRouter key either way.

`VITE_API_URL` is only an address, never the key. To try the build on this computer, run `npm run preview:site` (it uses the key in `.env`).

## Add another exercise

Use an agent to build the exercise. Open this repo in Cursor and ask it to add the lesson. Point it at `AGENTS.md`. That file is the contract: the export shape, the score rules, the model proxy, and the submodule steps. The two lessons already here were built that way. Hand-writing a module is how the scoring and the class sync drift apart.

An exercise is its own git repo, checked out under `exercises/` and registered in `src/lib/catalog.ts`. The classroom draws the frame: the top bar, level list, back and next, publish and unpublish, and the roster. The exercise only supplies slides.

`tokenization`, `cost`, and `prediction` are the exercises here. The agent should read any `src/index.tsx` before starting another.

### 1. Make the repo

Create a sibling folder, for example `../waves`, with this shape:

```text
waves/
  .gitignore          # at least .DS_Store
  README.md           # who the lesson is for, and what a student does
  package.json
  src/index.tsx       # export const exercise, and import './styles.css'
  src/types.ts        # the slide props, copied below
  src/styles.css      # classes prefixed with the exercise id
```

`package.json`:

```json
{
  "name": "futurebuilders-waves",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "peerDependencies": { "react": "^19.0.0" }
}
```

Do not add a build script. The classroom compiles the exercise. React and anything else already in the classroom `package.json` are available. A new library has to be added there, and listed as a peer dependency here. Prefer none.

Commit that repo on its own before the classroom points at it.

### 2. Export one `exercise` object

`src/types.ts`:

```ts
import type { ReactElement } from 'react'

export type SlideProps = {
  onComplete: (result: { score: number; detail?: string }) => void
  completed: boolean
}
```

`src/index.tsx` imports the slide components and the stylesheet, then exports `exercise`. Copy the shape from `exercises/tokenization/src/index.tsx`. The fields are:

| Field | Meaning |
|---|---|
| `id` | Stable id. Lowercase, unique across the catalog. No underscores and no commas. |
| `title`, `summary`, `minutes` | Shown on the landing page and the desk. |
| `kicker` | Short label above the title. The current lessons use `Exercise`. |
| `levels` | Ordered units the instructor can open or close. |
| `levels[].id` | Stable, unique inside the exercise, no commas (released levels are stored comma-separated). |
| `levels[].title`, `blurb` | The level heading. `blurb` is the mission, shown big under the title, in eight words or fewer. |
| `slides` | Ordered screens inside the level. |
| `slides[].id` | Stable, unique inside the level, no underscores. |
| `slides[].kind` | `lesson` or `challenge`. |
| `slides[].Component` | React component that receives `SlideProps`. |

Changing an id later orphans saved progress, because the stored key is `exerciseId__levelId__slideId`.

### 3. Score slides the way the desk expects

A lesson calls `onComplete({ score: 100, detail: 'Seen' })` when the student marks it read. Use 100. A score of 0 stays unmarked even on a lesson, so the button will not flip to “Seen”.

A challenge calls `onComplete` on every attempt. `score > 0` counts as passed and shows up in the roster tally. `score: 0` is recorded as viewed and does not count. The desk keeps the best passing score, so a later miss does not erase a pass. `detail` is a short note for the instructor, 400 characters or fewer.

Call `onComplete` from a click or from an effect, never during render. If an effect reports completion, guard it with a ref so a progress update does not fire it again.

The slide does not draw the level navigation or the back and next buttons. Those belong to the classroom.

### 4. Style it so it fits the room

The page is graph paper, with Fraunces for headings, Outfit for text, and IBM Plex Mono for labels. Colors live on `:root` in `src/styles.css` (`--ink`, `--signal`, `--signal-deep`, `--teal`, `--good`).

Build the screen from the shared `fb-` classes at the bottom of `src/styles.css` (big input, progress pips, result stamp, token blocks, cards), so every exercise looks and works the same. Prefix any extra class with the exercise id, the way tokenization uses `tok-` and prediction uses `pred-`. The classroom’s `button` rule paints a white button with ink text. A filled button in the exercise stylesheet has to set both `background` and `color`.

This is a high-school lesson, about ages 14 to 18. Say when a picture is a teaching model rather than the real system. The site is not an official MIT site, and it does not use the MIT logo. The header already says “MIT FutureBuilders, Interactive Exercises.”

### 5. Call a model only through the server

Slides that need a live model `fetch('/api/openrouter')`. `GET` returns `{ configured, models }`. `POST` sends `{ model, messages, maxTokens, temperature, logprobs, topLogprobs }` and returns `{ text, firstToken, lifted, model, usage, logprobs }`.

The key stays in `OPENROUTER_API_KEY` on the server. Never put it in the exercise, and never prefix it with `VITE_`. The allowlist and the 400-token cap are in `server/openrouter.mjs`. Adding a model means adding it there. Set `logprobs: true` only for a model that actually returns them. When `configured` is false, say so on the slide and leave the run button disabled.

`messages` is 1 to 24 items, each `system`, `user`, or `assistant`, each up to 6000 characters.

### 6. Register it in the classroom

From `classroom`, after the exercise repo has its first commit:

```bash
git -c protocol.file.allow=always submodule add ../waves exercises/waves
```

The `-c` flag is only needed for a local folder. It does not change git config. Then append the export in `src/lib/catalog.ts`:

```ts
import { exercise as waves } from '../../exercises/waves/src/index'

export const exercises: ExerciseModule[] = [tokenization, prediction, waves]
```

`tsconfig.json` already includes `exercises`, so `npx tsc --noEmit` typechecks the new slides. Do not import from `classroom/src` inside the exercise. The exercise has to stand on its own files plus the classroom’s installed packages.

Later edits happen in `exercises/waves`. Commit there, then in the classroom repo commit the updated submodule pointer.

### 7. Check it in the browser

Run `npm run dev` and open the landing page. The new lesson should be listed. As an instructor, select it, release one level, and publish. In a second tab, join as a student and confirm:

- a lesson’s “Got it” stays seen after a refresh
- a wrong challenge does not increase the roster count
- a right challenge does
- unpublish replaces the slides with the hold screen
- the layout still fits a phone-width window

The instructor preview at `/present/<code>` can open every level without publishing. That view does not write scores.

When the lesson is ready, deploy again with the steps in [Deploy to Netlify](#deploy-to-netlify). A local deploy already sees the new files. A git deploy also needs the exercise repo pushed and `git submodule set-url` pointed at that remote.
