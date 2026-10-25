# Local development and deployment

## Requirements

- Node.js 24.22 or newer
- npm
- A Cloudflare account with access to this project's Worker and D1 database

## Run locally

```sh
npm ci
cp .dev.vars.example .dev.vars
```

Add `OPENAI_API_KEY` to `.dev.vars` to enable text and image generation. The file is ignored by Git.

Apply the local database migrations, then start the app:

```sh
npx cf d1 migrations apply 0458a2ad-9007-4a48-8bc6-f55f15e33928 --local --persist-to .cloudflare/state
npm run dev -- --port 5196
```

Open `http://127.0.0.1:5196/corbs/`.

Build the app with:

```sh
npm run build
```

## Deploy to Cloudflare

Sign in with the Cloudflare CLI if needed:

```sh
npx cf auth login
```

Apply production migrations, build the assets, then deploy the Worker:

```sh
npx cf d1 migrations apply 0458a2ad-9007-4a48-8bc6-f55f15e33928
npm run build
npx cf deploy --prebuilt --secrets-file .dev.vars
```

The Cloudflare resources, account, database and routes are defined in `cloudflare.config.ts`. The Worker serves `keff.uk/corbs*` and redirects the old `keff.uk/lecorbusier*` paths to `/corbs/`, preserving creation links and query parameters. The PWA manifest keeps its existing identity so current installations continue to work.

Images and votes are stored in D1. The current deployment does not use R2. OpenAI generation runs through Cloudflare Workflows; WebSockets send live update notifications, while D1 remains the source of saved data.
