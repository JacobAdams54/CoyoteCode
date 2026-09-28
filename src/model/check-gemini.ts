import "dotenv/config";

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing. Add it to your local .env file.");
}

const client = new GoogleGenAI({ apiKey });

const interaction = await client.interactions.create({
  model: "gemini-3.5-flash-lite",
  input: "Reply with exactly: Gemini connection works.",
});

console.log(interaction.output_text);
