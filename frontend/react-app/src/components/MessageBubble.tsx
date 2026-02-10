import { Message } from "../stores/chatStore";

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-3xl rounded-2xl px-4 py-3 shadow-sm border ${
          isUser
            ? "bg-blue-600 text-white border-blue-500"
            : "bg-white text-slate-900 border-slate-200"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              isUser ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {isUser ? "You" : "AI"}
          </div>
          <div className="space-y-2">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>

            {!isUser && message.sourceFile && (
              <div className="mt-2 text-xs text-slate-600 border-t border-slate-200 pt-2">
                <p>
                  Source: '{message.sourceFile.filename}' by {message.sourceFile.uploader} on {message.sourceFile.uploadDate}
                </p>
              </div>
            )}

            <p className={`text-[11px] ${isUser ? "text-white/80" : "text-slate-500"}`}>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

