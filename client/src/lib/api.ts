import type { ChatResponse } from "../types/chat";

export async function sendMessage(message: string): Promise<ChatResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`Server returned an error (${response.status}).`);
  }

  return (await response.json()) as ChatResponse;
}
