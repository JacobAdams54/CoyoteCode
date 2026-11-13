import type { Message } from "../types/chat";

type MessageListProps = {
  messages: Message[];
  isLoading: boolean;
};

export default function MessageList({ messages, isLoading }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-logo" aria-hidden="true">
          C
        </span>
        <h1>What would you like to build?</h1>
        <p>Ask CoyoteCode about your project, code, or next idea.</p>
      </div>
    );
  }

  return (
    <div className="messages">
      {messages.map((message) => (
        <article className={`message message-${message.role}`} key={message.id}>
          <div className="message-role">
            {message.role === "user" ? "You" : "CoyoteCode"}
          </div>

          <div className="message-content">{message.content}</div>
        </article>
      ))}

      {isLoading && (
        <p className="loading-message" role="status">
          CoyoteCode is thinking…
        </p>
      )}
    </div>
  );
}
