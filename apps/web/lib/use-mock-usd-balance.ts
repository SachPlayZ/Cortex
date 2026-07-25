"use client";

import { useEffect, useState } from "react";

export function useMockUsdBalance(accountHash: string | undefined, refreshKey?: unknown): string | null {
  const [usdCents, setUsdCents] = useState<string | null>(null);

  useEffect(() => {
    if (!accountHash) {
      setUsdCents(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/casper/musdc-balance/${accountHash}`, { cache: "no-store" })
      .then((response) => response.json() as Promise<{ usdCents?: string }>)
      .then((body) => {
        if (!cancelled) setUsdCents(body.usdCents ?? null);
      })
      .catch(() => {
        if (!cancelled) setUsdCents(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accountHash, refreshKey]);

  return usdCents;
}
