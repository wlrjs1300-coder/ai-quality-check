import {
  ApiError,
  networkApiError,
  parseApiError,
  unexpectedApiError,
} from "./errors";
import {
  type DataResult,
  isFiniteNumber,
  isRecord,
  isString,
  type PaginatedResult,
  type Parser,
} from "./types";

type RequestOptions<T> = Omit<RequestInit, "body"> & {
  body?: unknown;
  parse: Parser<T>;
};

export type CsvDownload = {
  blob: Blob;
  filename: string;
};

function apiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!value) {
    throw unexpectedApiError(
      "NEXT_PUBLIC_API_BASE_URL is required. Check environment variable setup.",
    );
  }
  return value.replace(/\/+$/, "");
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl()}${normalizedPath}`;
}

function parseResponsePayload(text: string, response: Response): unknown {
  if (!text) {
    return null;
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const looksLikeJson = text.trim().startsWith("{") || text.trim().startsWith("[");
  if (!contentType.includes("application/json") && !looksLikeJson) {
    return text;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function fetchResponse(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(apiUrl(path), init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw networkApiError();
  }
}

export async function request<T>(path: string, options: RequestOptions<T>): Promise<T> {
  const { body, headers, parse, ...init } = options;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetchResponse(path, {
    ...init,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const payload = parseResponsePayload(text, response);
  const isJsonPayload = isRecord(payload) || Array.isArray(payload);

  if (!response.ok) {
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw networkApiError();
    }

    if (response.status >= 500) {
      if (isRecord(payload) && isRecord(payload.error)) {
        throw parseApiError(response.status, payload);
      }
      if (!isJsonPayload || isString(payload)) {
        throw networkApiError();
      }
    }

    throw parseApiError(response.status, payload);
  }

  if (text === "") {
    throw unexpectedApiError();
  }

  try {
    return parse(payload);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw unexpectedApiError();
  }
}

function safeFilename(value: string): string | null {
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  if (!trimmed || /[\\/\0\r\n]/.test(trimmed)) return null;
  return trimmed;
}

function contentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const encoded = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return safeFilename(decodeURIComponent(encoded));
    } catch {
      return null;
    }
  }
  const plain = header.match(/filename\s*=\s*("[^"]*"|[^;]+)/i)?.[1];
  return plain ? safeFilename(plain) : null;
}

export async function downloadCsv(
  path: string,
  fallbackFilename: string,
  signal?: AbortSignal,
): Promise<CsvDownload> {
  const response = await fetchResponse(path, {
    method: "GET",
    headers: { Accept: "text/csv, application/json" },
    signal,
  });
  const contentType = (response.headers.get("content-type") || "").toLowerCase();

  if (!response.ok) {
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw networkApiError();
    }
    if (contentType.includes("application/json")) {
      let payload: unknown = null;
      try {
        payload = JSON.parse(await response.text());
      } catch {
        throw unexpectedApiError();
      }
      throw parseApiError(response.status, payload);
    }
    if (response.status >= 500) throw networkApiError();
    throw unexpectedApiError();
  }

  if (!contentType.includes("text/csv")) {
    if (contentType.includes("application/json")) {
      let payload: unknown = null;
      try {
        payload = JSON.parse(await response.text());
      } catch {
        throw unexpectedApiError();
      }
      throw parseApiError(response.status, payload);
    }
    throw unexpectedApiError("CSV 응답 형식이 올바르지 않습니다.");
  }

  return {
    blob: await response.blob(),
    filename: contentDispositionFilename(response.headers.get("content-disposition"))
      ?? fallbackFilename,
  };
}

function parseMeta(value: unknown): { requestId: string } {
  if (!isRecord(value) || !isString(value.request_id)) {
    throw unexpectedApiError();
  }
  return { requestId: value.request_id };
}

export function getData<T>(
  path: string,
  parseData: Parser<T>,
  signal?: AbortSignal,
): Promise<DataResult<T>> {
  return request(path, {
    method: "GET",
    signal,
    parse(value) {
      if (!isRecord(value)) {
        throw unexpectedApiError();
      }
      return { data: parseData(value.data), ...parseMeta(value.meta) };
    },
  });
}

export function getPaginatedData<T>(
  path: string,
  parseItem: Parser<T>,
  signal?: AbortSignal,
): Promise<PaginatedResult<T>> {
  return request(path, {
    method: "GET",
    signal,
    parse(value) {
      if (!isRecord(value) || !Array.isArray(value.data) || !isRecord(value.meta)) {
        throw unexpectedApiError();
      }
      const pagination = value.meta.pagination;
      if (
        !isRecord(pagination) ||
        !isFiniteNumber(pagination.total) ||
        !isFiniteNumber(pagination.page) ||
        !isFiniteNumber(pagination.size)
      ) {
        throw unexpectedApiError();
      }
      return {
        data: value.data.map(parseItem),
        ...parseMeta(value.meta),
        pagination: {
          total: pagination.total,
          page: pagination.page,
          size: pagination.size,
        },
      };
    },
  });
}
