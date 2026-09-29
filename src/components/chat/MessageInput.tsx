import { useRef, useState } from "react";

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}

export function MessageInput({ onSend, disabled, disabledReason }: MessageInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = text.trim().length > 0 && text.trim().length <= 2000 && !disabled;

  const handleSend = () => {
    if (!canSend) return;
    onSend(text);
    setText("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-grow textarea
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  const charsLeft = 2000 - text.trim().length;

  return (
    <div className="border-t border-white/30 bg-white/30 backdrop-blur-md px-4 py-3">
      {disabledReason && (
        <p className="text-xs text-amber-600 mb-2 text-center">{disabledReason}</p>
      )}
      <div className="flex items-end space-x-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={disabled ? "Encryption not ready…" : "Type a message… (Enter to send, Shift+Enter for new line)"}
          aria-label="Message input"
          className="flex-1 resize-none rounded-xl border border-white/50 bg-white/40 px-3 py-2 text-sm text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/70 disabled:opacity-50 disabled:cursor-not-allowed max-h-36 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
          style={{ height: "auto" }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
      {text.trim().length > 1900 && (
        <p className={`text-xs mt-1 text-right ${charsLeft < 0 ? "text-red-500" : "text-gray-400"}`}>
          {charsLeft} characters left
        </p>
      )}
    </div>
  );
}
