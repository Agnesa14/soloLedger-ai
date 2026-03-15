"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const message = input.trim();
    if (!message) {
      setError("Write a question first.");
      return;
    }

    setLoading(true);
    setError("");
    setResponse("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(`API ${res.status}: ${data?.error ?? "Unknown error"}`);
      }

      setResponse(String(data.reply ?? ""));
      setInput("");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-bold">SoloLedger AI</h1>
      <p className="mt-2 text-sm text-gray-600">
        Form → Loading → AI Response (+ Error handling)
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <label className="block text-sm font-medium">Prompt</label>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
          placeholder="e.g., Create a monthly budget for a freelancer earning €1200"
          className="w-full rounded-md border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-black/20"
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? "Thinking…" : "Submit"}
        </button>
      </form>

      {loading ? (
        <div className="mt-6 animate-pulse rounded-md border bg-gray-50 p-4 text-gray-700">
          Working on it…
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      ) : null}

      {response ? (
        <div className="mt-6 rounded-md border bg-green-50 p-4">
          <h2 className="text-sm font-semibold text-green-900">AI Response</h2>
          <p className="mt-2 whitespace-pre-wrap text-gray-900">{response}</p>
        </div>
      ) : null}
    </main>
  );
}