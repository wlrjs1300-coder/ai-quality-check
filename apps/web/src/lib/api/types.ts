export type JsonObject = Record<string, unknown>;

export type Pagination = {
  total: number;
  page: number;
  size: number;
};

export type DataResult<T> = {
  data: T;
  requestId: string;
};

export type PaginatedResult<T> = {
  data: T[];
  requestId: string;
  pagination: Pagination;
};

export type Parser<T> = (value: unknown) => T;

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
