"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSession } from "@/lib/api";
import type { ParsedSession, TurnNode } from "@/lib/types";
import { TurnTable } from "@/components/TurnTable";
import { NodePanel } from "@/components/NodePanel";
import { SessionHeader } from "@/components/SessionHeader";

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<ParsedSession | null>(null);
  const [selectedTurn, setSelectedTurn] = useState<TurnNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getSession(id)
      .then(setSession)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Parsing session...</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400">{error ?? "Session not found"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SessionHeader session={session} />

      <div className="flex-1 flex">
        {/* Turn table — main area */}
        <div className={`flex-1 ${selectedTurn ? "mr-[400px]" : ""}`}>
          <TurnTable
            turns={session.turns}
            selectedTurnId={selectedTurn?.id ?? null}
            onSelectTurn={setSelectedTurn}
          />
        </div>

        {/* Side panel */}
        {selectedTurn && (
          <NodePanel turn={selectedTurn} onClose={() => setSelectedTurn(null)} />
        )}
      </div>
    </div>
  );
}
