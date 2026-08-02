import { getData, request } from "./client";
import { unexpectedApiError } from "./errors";
import {
  isBoolean,
  isFiniteNumber,
  isRecord,
  isString,
} from "./types";

export type QualityGateStatus = "PASS" | "BLOCK";

export type QualityGatePolicy = {
  id: string;
  projectId: string;
  name: string;
  minimumPassRate: string;
  blockOnError: boolean;
  blockOnRequiredCaseFailure: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type QualityGateResult = {
  id: string;
  policyId: string;
  experimentId: string;
  status: QualityGateStatus;
  passRate: string;
  totalCaseCount: number;
  passedCaseCount: number;
  failedCaseCount: number;
  errorCaseCount: number;
  requiredCaseFailureCount: number;
  reasonCodes: string[];
  reasonSummary: string | null;
  createdAt: string;
};

export type CreateQualityGatePolicyInput = {
  name: string;
  minimum_pass_rate: number;
  block_on_error: boolean;
  block_on_required_case_failure: boolean;
};

function fail(context: string): never {
  throw unexpectedApiError(`${context} 응답 형식이 올바르지 않습니다.`);
}

function decimal(value: unknown, context: string): string {
  if (isString(value) && value.trim() !== "" && Number.isFinite(Number(value))) {
    return value;
  }
  if (isFiniteNumber(value)) return String(value);
  return fail(context);
}

function dateTime(value: unknown, context: string): string {
  if (!isString(value) || Number.isNaN(Date.parse(value))) return fail(context);
  return value;
}

function stringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value) || !value.every(isString)) return fail(context);
  return [...value];
}

function parsePolicy(value: unknown): QualityGatePolicy {
  if (
    !isRecord(value)
    || !isString(value.id)
    || !isString(value.project_id)
    || !isString(value.name)
    || !isBoolean(value.block_on_error)
    || !isBoolean(value.block_on_required_case_failure)
    || !isBoolean(value.is_active)
  ) {
    return fail("Quality Gate Policy");
  }
  return {
    id: value.id,
    projectId: value.project_id,
    name: value.name,
    minimumPassRate: decimal(value.minimum_pass_rate, "Quality Gate Policy"),
    blockOnError: value.block_on_error,
    blockOnRequiredCaseFailure: value.block_on_required_case_failure,
    isActive: value.is_active,
    createdAt: dateTime(value.created_at, "Quality Gate Policy"),
    updatedAt: dateTime(value.updated_at, "Quality Gate Policy"),
  };
}

function parseResult(value: unknown): QualityGateResult {
  if (
    !isRecord(value)
    || !isString(value.id)
    || !isString(value.policy_id)
    || !isString(value.experiment_id)
    || (value.status !== "PASS" && value.status !== "BLOCK")
    || !isFiniteNumber(value.total_case_count)
    || !isFiniteNumber(value.passed_case_count)
    || !isFiniteNumber(value.failed_case_count)
    || !isFiniteNumber(value.error_case_count)
    || !isFiniteNumber(value.required_case_failure_count)
    || (value.reason_summary !== null && !isString(value.reason_summary))
  ) {
    return fail("Quality Gate Result");
  }
  return {
    id: value.id,
    policyId: value.policy_id,
    experimentId: value.experiment_id,
    status: value.status,
    passRate: decimal(value.pass_rate, "Quality Gate Result"),
    totalCaseCount: value.total_case_count,
    passedCaseCount: value.passed_case_count,
    failedCaseCount: value.failed_case_count,
    errorCaseCount: value.error_case_count,
    requiredCaseFailureCount: value.required_case_failure_count,
    reasonCodes: stringArray(value.reason_codes, "Quality Gate Result"),
    reasonSummary: value.reason_summary,
    createdAt: dateTime(value.created_at, "Quality Gate Result"),
  };
}

export function createQualityGatePolicy(
  projectId: string,
  input: CreateQualityGatePolicyInput,
  signal?: AbortSignal,
) {
  return request(`/projects/${encodeURIComponent(projectId)}/quality-gate-policies`, {
    method: "POST",
    body: input,
    signal,
    parse(value) {
      if (!isRecord(value) || !isRecord(value.meta) || !isString(value.meta.request_id)) {
        return fail("Quality Gate Policy");
      }
      return { data: parsePolicy(value.data), requestId: value.meta.request_id };
    },
  });
}

export function getQualityGatePolicy(policyId: string, signal?: AbortSignal) {
  return getData(
    `/quality-gate-policies/${encodeURIComponent(policyId)}`,
    parsePolicy,
    signal,
  );
}

export function evaluateQualityGate(
  policyId: string,
  experimentId: string,
  signal?: AbortSignal,
) {
  return request(`/quality-gate-policies/${encodeURIComponent(policyId)}/evaluate`, {
    method: "POST",
    body: { experiment_id: experimentId },
    signal,
    parse(value) {
      if (!isRecord(value) || !isRecord(value.meta) || !isString(value.meta.request_id)) {
        return fail("Quality Gate Result");
      }
      return { data: parseResult(value.data), requestId: value.meta.request_id };
    },
  });
}

export function getQualityGateResult(resultId: string, signal?: AbortSignal) {
  return getData(
    `/quality-gate-results/${encodeURIComponent(resultId)}`,
    parseResult,
    signal,
  );
}
