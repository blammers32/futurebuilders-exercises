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

## Netlify

```bash
npm run build
```

`netlify.toml` publishes `dist` and routes `/api/openrouter` to the function. In the Netlify site settings, set `OPENROUTER_API_KEY` and the `VITE_FIREBASE_*` variables, then turn on submodule cloning if this repo’s exercise URLs point at remotes.

The SPA fallback is already configured.

## Exercises are submodules

`exercises/tokenization` and `exercises/prediction` are separate git repos. Each one exports an `exercise` object: levels, slides, and a React component per slide. The desk imports them from `src/lib/catalog.ts`.

A slide calls `onComplete({ score, detail })`. Lessons send a score of 100 when the student marks them seen. Challenges send 0 until they pass. The desk keeps the best score.

To add another lesson, make a repo with the same export shape, add it as a submodule under `exercises/`, and append it in `src/lib/catalog.ts`.
