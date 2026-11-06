import express, { type Express, type Request, type Response } from "express";

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

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`CoyoteCode backend listening on http://localhost:${port}`);
});
