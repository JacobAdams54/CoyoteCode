import { useState } from "react";

import MessageList from "./components/MessageList";
import PromptInput from "./components/PromptInput";
import Sidebar from "./components/Sidebar";
import { sendMessage } from "./lib/api";
import type { Message } from "./types/chat";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);

  async function handleSend(content: string) {
    if (isLoading) {
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };

    // Show the user's message immediately.
    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setError(null);
    setIsLoading(true);

    try {
      const response = await sendMessage(content);

      setMessages((currentMessages) => [...currentMessages, response.message]);
    } catch (error) {
      console.error("Failed to send message:", error);
      setError("Could not get a response. Check that the backend is running.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleNewChat() {
    setMessages([]);
    setError(null);

    // Reset the prompt component, including any unfinished text.
    setChatKey((currentKey) => currentKey + 1);
  }

  return (
    <div className="app-shell">
      <Sidebar onNewChat={handleNewChat} disabled={isLoading} />

      <main className="main-panel">
        <header className="top-bar">
          <span>New conversation</span>
        </header>

        <section className="chat-area" aria-label="Conversation">
          <MessageList messages={messages} isLoading={isLoading} />
        </section>

        <div className="composer-area">
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <PromptInput
            key={chatKey}
            onSend={handleSend}
            isLoading={isLoading}
          />

          <p className="composer-caption">
            CoyoteCode can make mistakes. Review generated code before using it.
          </p>
        </div>
      </main>
    </div>
  );
}
