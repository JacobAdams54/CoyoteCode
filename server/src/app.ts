import express, { type Express, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
const app: Express = express();

app.use(express.json());
app.use((_req: Request, res: Response, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  next();
});

app.get("/", (req: Request, res: Response) => {
  res.json({ name: "CoyoteCode backend", status: "ok" });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.post("/api/chat", async (req: Request, res: Response) => {
  const message: unknown = req.body?.message;

  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({
      error: "A non-empty message is required.",
    });
    return;
  }

  // Simulate a short delay so the frontend can show its loading state.
  await new Promise((resolve) => setTimeout(resolve, 750));

  res.json({
    message: {
      id: randomUUID(),
      role: "assistant",
      content: `I received: "${message.trim()}"\n\nThis is a mock response from the CoyoteCode backend.`,
    },
  });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`CoyoteCode backend listening on http://localhost:${port}`);
});
