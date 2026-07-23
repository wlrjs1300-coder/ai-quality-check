import { getData, getPaginatedData, request } from "./client";
import { unexpectedApiError } from "./errors";
import {
  isFiniteNumber,
  isNullableString,
  isRecord,
  isString,
} from "./types";

export type ExperimentStatus = "CREATED" | "RUNNING" | "COMPLETED" | "FAILED";
export type EvaluationResultStatus = "PASS" | "FAIL" | "ERROR";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type Experiment = {
  id: string;
  datasetVersionId: string;
  targetVersionId: string;
  evaluatorVersionId: string;
  status: ExperimentStatus;
  totalCases: number;
  passCount: number;
  failCount: number;
  errorCount: number;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type EvaluationResult = {
  id: string;
  experimentId: string;
  datasetVersionCaseId: string;
  inputSnapshot: JsonValue;
  outputSnapshot: JsonValue;
  status: EvaluationResultStatus;
  reasonCode: string | null;
  reason: string | null;
  createdAt: string;
};

export type ExperimentCreateInput = {
  dataset_version_id: string;
  target_version_id: string;
  evaluator_version_id: string;
};

const EXPERIMENT_STATUSES = ["CREATED", "RUNNING", "COMPLETED", "FAILED"] as const;
const RESULT_STATUSES = ["PASS", "FAIL", "ERROR"] as const;

function fail(label: string): never {
  throw unexpectedApiError(`${label} 응답 형식이 올바르지 않습니다.`);
}

function oneOf<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
): T {
  if (!isString(value) || !values.includes(value as T)) {
    return fail(label);
  }
  return value as T;
}

function dateTime(value: unknown, label: string): string {
  if (!isString(value) || Number.isNaN(Date.parse(value))) {
    return fail(label);
  }
  return value;
}

function nullableDateTime(value: unknown, label: string): string | null {
  return value === null ? null : dateTime(value, label);
}

function parseJsonValue(value: unknown, label: string): JsonValue {
  if (
    value === null
    || isString(value)
    || typeof value === "boolean"
    || isFiniteNumber(value)
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => parseJsonValue(item, label));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, parseJsonValue(item, label)]),
    );
  }
  return fail(label);
}

export function parseExperiment(value: unknown): Experiment {
  if (
    !isRecord(value)
    || !isString(value.id)
    || !isString(value.dataset_version_id)
    || !isString(value.target_version_id)
    || !isString(value.evaluator_version_id)
    || !isFiniteNumber(value.total_cases)
    || !isFiniteNumber(value.pass_count)
    || !isFiniteNumber(value.fail_count)
    || !isFiniteNumber(value.error_count)
    || !isNullableString(value.error_code)
    || !isNullableString(value.error_message)
  ) {
    return fail("Experiment");
  }

  return {
    id: value.id,
    datasetVersionId: value.dataset_version_id,
    targetVersionId: value.target_version_id,
    evaluatorVersionId: value.evaluator_version_id,
    status: oneOf(value.status, EXPERIMENT_STATUSES, "Experiment"),
    totalCases: value.total_cases,
    passCount: value.pass_count,
    failCount: value.fail_count,
    errorCount: value.error_count,
    completedAt: nullableDateTime(value.completed_at, "Experiment"),
    errorCode: value.error_code,
    errorMessage: value.error_message,
  };
}

function parseEvaluationResult(value: unknown): EvaluationResult {
  if (
    !isRecord(value)
    || !isString(value.id)
    || !isString(value.experiment_id)
    || !isString(value.dataset_version_case_id)
    || !isNullableString(value.reason_code)
    || !isNullableString(value.reason)
  ) {
    return fail("Evaluation Result");
  }

  return {
    id: value.id,
    experimentId: value.experiment_id,
    datasetVersionCaseId: value.dataset_version_case_id,
    inputSnapshot: parseJsonValue(value.input_snapshot, "Evaluation Result"),
    outputSnapshot: parseJsonValue(value.output_snapshot, "Evaluation Result"),
    status: oneOf(value.status, RESULT_STATUSES, "Evaluation Result"),
    reasonCode: value.reason_code,
    reason: value.reason,
    createdAt: dateTime(value.created_at, "Evaluation Result"),
  };
}

function parseDataResponse<T>(value: unknown, parser: (input: unknown) => T) {
  if (!isRecord(value) || !isRecord(value.meta) || !isString(value.meta.request_id)) {
    return fail("API");
  }
  return { data: parser(value.data), requestId: value.meta.request_id };
}

export function createExperiment(input: ExperimentCreateInput, signal?: AbortSignal) {
  return request("/experiments", {
    method: "POST",
    body: input,
    signal,
    parse: (value) => parseDataResponse(value, parseExperiment),
  });
}

export function getExperiment(experimentId: string, signal?: AbortSignal) {
  return getData(
    `/experiments/${encodeURIComponent(experimentId)}`,
    parseExperiment,
    signal,
  );
}

export function runExperiment(experimentId: string, signal?: AbortSignal) {
  return request(`/experiments/${encodeURIComponent(experimentId)}/run`, {
    method: "POST",
    signal,
    parse: (value) => parseDataResponse(value, parseExperiment),
  });
}

export function listExperimentResults(
  experimentId: string,
  page = 1,
  size = 20,
  signal?: AbortSignal,
) {
  return getPaginatedData(
    `/experiments/${encodeURIComponent(experimentId)}/results?page=${page}&size=${size}`,
    parseEvaluationResult,
    signal,
  );
}
