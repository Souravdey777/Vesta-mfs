"use client";

import * as React from "react";

import type { FilterState, FundsQueryData } from "@/lib/types";

type FundsApiResponse =
  | {
      ok: true;
      data: FundsQueryData;
    }
  | {
      ok: false;
      error: string;
      issues?: Array<{
        path: string;
        message: string;
      }>;
    };

export type UseFundsResult = {
  data: FundsQueryData | null;
  error: string | null;
  refetch: () => void;
  status: "idle" | "loading" | "success" | "error";
};

export function useFunds(
  filters: FilterState,
  {
    enabled = true,
    fetcher = fetch
  }: {
    enabled?: boolean;
    fetcher?: typeof fetch;
  } = {}
): UseFundsResult {
  const [data, setData] = React.useState<FundsQueryData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<UseFundsResult["status"]>("idle");
  const [refreshIndex, setRefreshIndex] = React.useState(0);
  const queryString = React.useMemo(() => buildFundsQueryString(filters), [filters]);

  React.useEffect(() => {
    if (!enabled || !queryString) {
      setData(null);
      setError(null);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();

    async function loadFunds() {
      setStatus("loading");
      setError(null);

      try {
        const response = await fetcher(`/api/funds?${queryString}`, {
          signal: controller.signal
        });
        const body = (await response.json()) as FundsApiResponse;

        if (!response.ok || !body.ok) {
          throw new Error(body.ok ? "Unable to load funds right now." : body.error);
        }

        setData(body.data);
        setStatus("success");
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        setData(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load funds right now.");
        setStatus("error");
      }
    }

    void loadFunds();

    return () => {
      controller.abort();
    };
  }, [enabled, fetcher, queryString, refreshIndex]);

  const refetch = React.useCallback(() => {
    setRefreshIndex((current) => current + 1);
  }, []);

  return {
    data,
    error,
    refetch,
    status
  };
}

export function buildFundsQueryString(filters: FilterState): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  params.set("page", "1");
  params.set("pageSize", "25");

  return params.toString();
}
