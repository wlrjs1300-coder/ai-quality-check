import { getData, getPaginatedData, request } from "./client";
import { unexpectedApiError } from "./errors";
import {
  isFiniteNumber,
  isRecord,
  isString,
} from "./types";

export type ComparisonStatus = "IMPROVED" | "UNCHANGED" | "REGRESSED";
export type ComparisonCaseStatus = "PASS" | "FAIL" | "ERROR";

export type BaselineComparison = {
  id: string;
  projectId: string;
  baselineExperimentId: string;
  currentExperimentId: string;
  status: ComparisonStatus;
  totalCaseCount: number;
  improvedCaseCount: number;
  unchangedCaseCount: number;
  regressedCaseCount: number;
  baselinePassedCaseCount: number;
  currentPassedCaseCount: number;
  passRateDelta: string;
  reasonCodes: string[];
  reasonSummary: string | null;
  createdAt: string;
};

export type BaselineComparisonCase = {
  id: string;
  comparisonId: string;
  datasetVersionCaseId: string;
  caseKey: string;
  baselineStatus: ComparisonCaseStatus;
  currentStatus: ComparisonCaseStatus;
  changeStatus: ComparisonStatus;
  reasonCode: string;
  createdAt: string;
};

function fail(context: string): never {
  throw unexpectedApiError(`${context} 응답 형식이 올바르지 않습니다.`);
}

function comparisonStatus(value: unknown, context: string): ComparisonStatus {
  if (value === "IMPROVED" || value === "UNCHANGED" || value === "REGRESSED") {
    return value;
  }
  return fail(context);
}

function caseStatus(value: unknown, context: string): ComparisonCaseStatus {
  if (value === "PASS" || value === "FAIL" || value === "ERROR") return value;
  return fail(context);
}

function dateTime(value: unknown, context: string): string {
  if (!isString(value) || Number.isNaN(Date.parse(value))) return fail(context);
  return value;
}

function decimal(value: unknown, context: string): string {
  if (!isString(value) || value.trim() === "" || !Number.isFinite(Number(value))) {
    return fail(context);
  }
  return value;
}

function stringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value) || !value.every(isString)) return fail(context);
  return [...value];
}

function parseComparison(value: unknown): BaselineComparison {
  if (
    !isRecord(value)
    || !isString(value.id)
    || !isString(value.project_id)
    || !isString(value.baseline_experiment_id)
    || !isString(value.current_experiment_id)
    || !isFiniteNumber(value.total_case_count)
    || !isFiniteNumber(value.improved_case_count)
    || !isFiniteNumber(value.unchanged_case_count)
    || !isFiniteNumber(value.regressed_case_count)
    || !isFiniteNumber(value.baseline_passed_case_count)
    || !isFiniteNumber(value.current_passed_case_count)
    || (value.reason_summary !== null && !isString(value.reason_summary))
  ) {
    return fail("Baseline Comparison");
  }
  return {
    id: value.id,
    projectId: value.project_id,
    baselineExperimentId: value.baseline_experiment_id,
    currentExperimentId: value.current_experiment_id,
    status: comparisonStatus(value.status, "Baseline Comparison"),
    totalCaseCount: value.total_case_count,
    improvedCaseCount: value.improved_case_count,
    unchangedCaseCount: value.unchanged_case_count,
    regressedCaseCount: value.regressed_case_count,
    baselinePassedCaseCount: value.baseline_passed_case_count,
    currentPassedCaseCount: value.current_passed_case_count,
    passRateDelta: decimal(value.pass_rate_delta, "Baseline Comparison"),
    reasonCodes: stringArray(value.reason_codes, "Baseline Comparison"),
    reasonSummary: value.reason_summary,
    createdAt: dateTime(value.created_at, "Baseline Comparison"),
  };
}

function parseComparisonCase(value: unknown): BaselineComparisonCase {
  if (
    !isRecord(value)
    || !isString(value.id)
    || !isString(value.comparison_id)
    || !isString(value.dataset_version_case_id)
    || !isString(value.case_key)
    || !isString(value.reason_code)
  ) {
    return fail("Baseline Comparison Case");
  }
  return {
    id: value.id,
    comparisonId: value.comparison_id,
    datasetVersionCaseId: value.dataset_version_case_id,
    caseKey: value.case_key,
    baselineStatus: caseStatus(value.baseline_status, "Baseline Comparison Case"),
    currentStatus: caseStatus(value.current_status, "Baseline Comparison Case"),
    changeStatus: comparisonStatus(value.change_status, "Baseline Comparison Case"),
    reasonCode: value.reason_code,
    createdAt: dateTime(value.created_at, "Baseline Comparison Case"),
  };
}

export function createBaselineComparison(
  baselineExperimentId: string,
  currentExperimentId: string,
  signal?: AbortSignal,
) {
  return request("/baseline-comparisons", {
    method: "POST",
    body: {
      baseline_experiment_id: baselineExperimentId,
      current_experiment_id: currentExperimentId,
    },
    signal,
    parse(value) {
      if (!isRecord(value) || !isRecord(value.meta) || !isString(value.meta.request_id)) {
        return fail("Baseline Comparison");
      }
      return { data: parseComparison(value.data), requestId: value.meta.request_id };
    },
  });
}

export function getBaselineComparison(comparisonId: string, signal?: AbortSignal) {
  return getData(
    `/baseline-comparisons/${encodeURIComponent(comparisonId)}`,
    parseComparison,
    signal,
  );
}

export function listBaselineComparisonCases(
  comparisonId: string,
  page = 1,
  size = 20,
  signal?: AbortSignal,
) {
  return getPaginatedData(
    `/baseline-comparisons/${encodeURIComponent(comparisonId)}/cases?page=${page}&size=${size}`,
    parseComparisonCase,
    signal,
  );
}
