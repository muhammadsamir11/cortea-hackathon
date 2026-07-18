"use client";

import { useCallback, useEffect, useState } from "react";

export type Decision = "confirmed" | "dismissed" | "info";
export interface ReviewEntry {
  decision?: Decision;
  note?: string;
  at?: string;
}
type ReviewMap = Record<string, ReviewEntry>;

const key = (dossier: string) => `cortea:review:${dossier}`;

export function useReview(dossier: string, total: number) {
  const [map, setMap] = useState<ReviewMap>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(dossier));
      setMap(raw ? (JSON.parse(raw) as ReviewMap) : {});
    } catch {
      setMap({});
    }
    setLoaded(true);
  }, [dossier]);

  const persist = useCallback(
    (next: ReviewMap) => {
      setMap(next);
      try {
        localStorage.setItem(key(dossier), JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
    },
    [dossier],
  );

  const get = useCallback((id: string): ReviewEntry => map[id] ?? {}, [map]);

  const set = useCallback(
    (id: string, decision: Decision) => {
      const current = map[id]?.decision;
      const next = { ...map };
      if (current === decision) {
        // toggle off → back to pending, keep any note
        next[id] = { ...next[id], decision: undefined, at: new Date().toISOString() };
      } else {
        next[id] = { ...next[id], decision, at: new Date().toISOString() };
      }
      persist(next);
    },
    [map, persist],
  );

  const setNote = useCallback(
    (id: string, note: string) => {
      persist({ ...map, [id]: { ...map[id], note } });
    },
    [map, persist],
  );

  const reset = useCallback(() => persist({}), [persist]);

  const decided = Object.values(map).filter((e) => e.decision).length;

  return { map, get, set, setNote, reset, loaded, progress: { decided, total } };
}
