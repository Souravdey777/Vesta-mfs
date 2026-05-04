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
  setPage: (page: number) => void;
  status: "idle" | "loading" | "success" | "error";
};

type BuildFundsQueryStringOptions = {
  page?: number;
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
  const filtersKey = React.useMemo(() => JSON.stringify(filters), [filters]);
  const [pagination, setPagination] = React.useState(() => ({
    filtersKey,
    page: 1
  }));
  const page = pagination.filtersKey === filtersKey ? pagination.page : 1;
  const [status, setStatus] = React.useState<UseFundsResult["status"]>("idle");
  const [refreshIndex, setRefreshIndex] = React.useState(0);
  const queryString = React.useMemo(() => buildFundsQueryString(filters, { page }), [filters, page]);

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

  const setPage = React.useCallback(
    (nextPage: number) => {
      setPagination({
        filtersKey,
        page: normalizePage(nextPage)
      });
    },
    [filtersKey]
  );

  React.useEffect(() => {
    if (data && data.pageCount > 0 && page > data.pageCount) {
      setPage(data.pageCount);
    }
  }, [data, page, setPage]);

  return {
    data,
    error,
    refetch,
    setPage,
    status
  };
}

export function buildFundsQueryString(
  filters: FilterState,
  { page = 1 }: BuildFundsQueryStringOptions = {}
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  params.set("page", String(normalizePage(page)));
  params.set("pageSize", "25");

  return params.toString();
}

function normalizePage(page: number): number {
  return Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
}
