import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import coyoteCodeLogo from "../assets/CoyoteCodeLogo.png";

import type { Message } from "../types/chat";

type MessageListProps = {
  messages: Message[];
  isLoading: boolean;
};

export default function MessageList({ messages, isLoading }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="empty-state">
        <img className="welcome-logo" src={coyoteCodeLogo} alt="CoyoteCode" />
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

          <div className="message-content">
            {message.role === "assistant" ? (
              <div className="markdown-content">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  skipHtml
                >
                  {message.content}
                </Markdown>
              </div>
            ) : (
              message.content
            )}
          </div>
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
