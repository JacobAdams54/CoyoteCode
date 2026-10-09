# CoyoteCode

CoyoteCode is a beginner-friendly TypeScript workshop project for building a
cloud coding agent. The project includes offline checks and an optional Gemini
API demo.

## Prerequisites

- Node.js **24.x** (the supported range is `>=24 <25`)
- npm (included with Node.js)
- Git

Run every command below from the repository root:

```text
CoyoteCode/
```

## Install and verify the project

Clone the repository into a new directory, then enter that directory:

```bash
git clone https://github.com/JacobAdams54/CoyoteCode.git
cd CoyoteCode
```

Install the locked dependencies:

```bash
npm ci
```

Run the offline checks. These do not require an API key or network access to
Gemini:

```bash
npm run check
npm test
```

- `npm run check` runs the TypeScript compiler without creating build files.
- `npm test` runs the Vitest test suite once.
- `npm run test:watch` runs Vitest in watch mode while developing.

At this point the project is installed and verified. The tests and type check
are separate from the Gemini demo.

## Optional Gemini API demo

The demo sends a request to Google's Gemini API, so it requires a Gemini API
key and network access. Keep credentials in a local `.env` file; never commit
that file.

1. Copy the example configuration:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set `GEMINI_API_KEY` to your own key. `GEMINI_MODEL` may be
   left at the example value or changed to a model available to your account;
   it controls the agent demo.

3. Run the one-request connection check:

   ```bash
   npm run gemini:check
   ```

4. Run the agent demo:

   ```bash
   npm run dev
   ```

   To provide a different task:

   ```bash
   npm run dev -- "List the files in src."
   ```

The demo is not part of `npm test`. It makes a live API request and may incur
provider charges.

## Troubleshooting

- `npm ci` must be run from the repository root, where `package-lock.json`
  exists. If Node is outside the supported range, install Node 24.x and retry.
- If the Gemini commands fail with
  `GEMINI_API_KEY is missing. Add it to your local .env file.`, create `.env`
  from `.env.example` and set the key. Do not paste the key into issues,
  commits, or chat.
- If `npm run check` or `npm test` fails, first confirm the install completed
  successfully and that the command is being run from the repository root.

## Available commands

| Command | Purpose | API key required |
| --- | --- | --- |
| `npm ci` | Install locked dependencies | No |
| `npm run check` | Type-check the project | No |
| `npm test` | Run tests once | No |
| `npm run test:watch` | Run tests in watch mode | No |
| `npm run gemini:check` | Check a live Gemini connection | Yes |
| `npm run dev` | Run the Gemini coding-agent demo | Yes |
