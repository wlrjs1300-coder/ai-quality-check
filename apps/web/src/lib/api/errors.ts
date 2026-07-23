import { isRecord, isString } from "./types";

export type ApiErrorKind =
  | "application"
  | "validation"
  | "network"
  | "unexpected";

export type FieldErrors = Record<string, string[]>;

type ApiErrorOptions = {
  kind: ApiErrorKind;
  status: number | null;
  code: string;
  message: string;
  details?: unknown;
  fieldErrors?: FieldErrors;
  retryable?: boolean;
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly details: unknown;
  readonly fieldErrors: FieldErrors;
  readonly retryable: boolean;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = "ApiError";
    this.kind = options.kind;
    this.status = options.status;
    this.code = options.code;
    this.details = options.details ?? null;
    this.fieldErrors = options.fieldErrors ?? {};
    this.retryable = options.retryable ?? false;
  }
}

function validationFieldErrors(detail: unknown[]): FieldErrors {
  const result: FieldErrors = {};

  for (const item of detail) {
    if (!isRecord(item) || !Array.isArray(item.loc) || !isString(item.msg)) {
      continue;
    }

    const field = item.loc.at(-1);
    const key = isString(field) || typeof field === "number" ? String(field) : "form";
    result[key] = [...(result[key] ?? []), item.msg];
  }

  return result;
}

export function parseApiError(status: number, payload: unknown): ApiError {
  if (isRecord(payload) && isRecord(payload.error)) {
    const { code, message, details } = payload.error;
    if (isString(code) && isString(message)) {
      return new ApiError({
        kind: "application",
        status,
        code,
        message,
        details,
        retryable: status >= 500,
      });
    }
  }

  if (status === 422 && isRecord(payload) && Array.isArray(payload.detail)) {
    return new ApiError({
      kind: "validation",
      status,
      code: "REQUEST_VALIDATION_FAILED",
      message: "입력값을 확인해 주세요.",
      details: payload.detail,
      fieldErrors: validationFieldErrors(payload.detail),
    });
  }

  return new ApiError({
    kind: "unexpected",
    status,
    code: "UNEXPECTED_RESPONSE",
    message: "응답 포맷이 올바르지 않습니다.",
    details: payload,
    retryable: false,
  });
}

export function networkApiError(): ApiError {
  return new ApiError({
    kind: "network",
    status: null,
    code: "NETWORK_ERROR",
    message: "서버에 연결할 수 없습니다. Backend 서버 상태를 확인한 뒤 다시 시도해 주세요.",
    retryable: true,
  });
}

export function unexpectedApiError(message = "응답 형식이 유효하지 않습니다."): ApiError {
  return new ApiError({
    kind: "unexpected",
    status: null,
    code: "UNEXPECTED_RESPONSE",
    message,
  });
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  return unexpectedApiError("응답 처리를 실패했습니다. 잠시 후 다시 시도해 주세요.");
}
