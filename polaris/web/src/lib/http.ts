/**
 * Fetch wrapper for the POLARIS API.
 *
 * - GETs retry twice (transient network / restart blips), 800ms then 2.8s.
 * - The backend's error envelope {error:{code,message,status,hint}} is unpacked
 *   into a typed PolarisError so components can surface the backend's own
 *   recovery hint (e.g. "seed demo data" or "wait for training to finish").
 * - 4xx other than 429 are NOT retried — the same request will fail again.
 */

import { toCamelCase, toSnakeCase } from "./caseConvert";
import type { ApiErrorEnvelope } from "./types";

const RETRY_DELAYS_MS = [800, 2800];
const REQUEST_TIMEOUT_MS = 120_000; // route optimization can take ~8s cold; leave headroom

export class PolarisError extends Error {
  readonly code: string;
  readonly status: number;
  readonly hint?: string;

  constructor(code: string, message: string, status: number, hint?: string) {
    super(message);
    this.name = "PolarisError";
    this.code = code;
    this.status = status;
    this.hint = hint;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST";
  /** camelCase body — converted to snake_case on the wire. */
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseError(res: Response): Promise<PolarisError> {
  let envelope: (ApiErrorEnvelope & { detail?: unknown }) | null = null;
  try {
    envelope = (await res.json()) as (ApiErrorEnvelope & { detail?: unknown });
  } catch {
    /* non-JSON body */
  }
  const err = envelope?.error;
  let detailMessage: string | undefined;
  if (typeof envelope?.detail === "string") {
    detailMessage = envelope.detail;
  } else if (Array.isArray(envelope?.detail)) {
    detailMessage = envelope.detail
      .map((d: { msg?: string }) => d.msg ?? JSON.stringify(d))
      .join("; ");
  } else if (envelope?.detail && typeof envelope.detail === "object") {
    const dObj = envelope.detail as { message?: string };
    detailMessage = dObj.message ?? JSON.stringify(envelope.detail);
  }

  const message = err?.message ?? detailMessage ?? `Request failed with status ${res.status}`;

  return new PolarisError(
    err?.code ?? `HTTP_${res.status}`,
    message,
    res.status,
    err?.hint,
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal } = options;

  const init: RequestInit = { method, signal };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(toSnakeCase(body));
  }

  const url = buildUrl(path, query);

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      const timer = new AbortController();
      const timeout = setTimeout(() => timer.abort(), REQUEST_TIMEOUT_MS);
      const onOuterAbort = () => timer.abort();
      signal?.addEventListener("abort", onOuterAbort);
      try {
        res = await fetch(url, { ...init, signal: timer.signal });
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onOuterAbort);
      }
    } catch (e) {
      // caller aborted — propagate immediately, never retry
      if (signal?.aborted || e instanceof DOMException && e.name === "AbortError") {
        throw e;
      }
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new PolarisError("NETWORK_ERROR", "Cannot reach the POLARIS server.", 0, "Is the backend running on :8000?");
    }

    if (res.ok) {
      const json = (await res.json()) as T;
      return toCamelCase(json);
    }

    const error = await parseError(res);
    // 429 (rate limited) retries; other 4xx never will — fail fast with the envelope.
    if ((error.status === 429 || error.status >= 500) && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    throw error;
  }
}
