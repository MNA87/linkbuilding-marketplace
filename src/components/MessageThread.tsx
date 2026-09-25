"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { MESSAGE_MAX_LENGTH } from "@/lib/orderMessages";

export type ThreadMessage = { id: string; mine: boolean; author: string; time: string; body: string };

// The conversation about one link, as a chat, with a box to reply. Used by
// the customer (Mijn orders) and by admin (the order page), each with its
// own send action.
export default function MessageThread({
  orderItemId,
  messages,
  sendAction,
  placeholder,
  note,
  empty,
  unread,
  markReadAction,
}: {
  orderItemId: string;
  messages: ThreadMessage[];
  sendAction: (orderItemId: string, body: string) => Promise<{ error: string | null; success: boolean }>;
  placeholder: string;
  note: string;
  empty: string;
  // Unread messages from the other side: opening the thread marks them
  // read, and the refresh brings the red counts in the menu up to date.
  unread: boolean;
  markReadAction: (orderItemId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!unread) return;
    markReadAction(orderItemId)
      .then(() => router.refresh())
      .catch(() => {});
  }, [unread, orderItemId, markReadAction, router]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    const result = await sendAction(orderItemId, body).catch(() => null);
    setSending(false);
    if (!result?.success) {
      setError(result?.error ?? "Versturen mislukt. Probeer het opnieuw.");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div>
      {messages.length > 0 ? (
        <div className="mb-4 flex flex-col gap-2.5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.mine ? "self-end rounded-tr-sm bg-brandSoft/60" : "self-start rounded-tl-sm bg-gray-100"
              }`}
            >
              <div className="mb-0.5 text-[11px] text-inkSoft">
                {m.author} · {m.time}
              </div>
              <div className="whitespace-pre-wrap break-words text-ink">{m.body}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-sm text-inkSoft">{empty}</p>
      )}

      <form onSubmit={send}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          maxLength={MESSAGE_MAX_LENGTH}
          rows={3}
          aria-label="Bericht"
          className="w-full resize-y rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-2 flex items-center gap-3">
          <p className="text-xs text-inkSoft">{note}</p>
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="btn-primary ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium disabled:opacity-60"
          >
            <Send size={14} />
            {sending ? "Versturen..." : "Versturen"}
          </button>
        </div>
      </form>
    </div>
  );
}
