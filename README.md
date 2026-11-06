# CoyoteCode

CoyoteCode is a TypeScript monorepo with three applications:

- `agent/` - the terminal coding agent and agent harness
- `server/` - the Express API
- `client/` - the React/Vite frontend

## Setup

Requirements: Node.js 20 or newer.

```bash
npm install
npm run check
npm test
npm run build
```

Run each application in a separate terminal:

```bash
npm run dev:backend
npm run dev:client
npm run dev:agent
```

The frontend runs at `http://localhost:5173` and proxies `/api` requests to
the backend at `http://localhost:3000`.
