import { useState, type FormEvent } from "react";

type PromptInputProps = {
  onSend: (content: string) => void;
  isLoading: boolean;
};

export default function PromptInput({ onSend, isLoading }: PromptInputProps) {
  const [prompt, setPrompt] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = prompt.trim();

    if (!content || isLoading) {
      return;
    }

    onSend(content);
    setPrompt("");
  }

  return (
    <form className="prompt-form" onSubmit={handleSubmit}>
      <label className="visually-hidden" htmlFor="prompt">
        Message CoyoteCode
      </label>

      <textarea
        id="prompt"
        rows={3}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Ask anything about your project..."
        disabled={isLoading}
      />

      <div className="prompt-footer">
        <span className="prompt-hint">Describe what you want to work on</span>

        <button
          className="send-button"
          type="submit"
          disabled={!prompt.trim() || isLoading}
        >
          {isLoading ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
