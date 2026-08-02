import { getData, getPaginatedData, request } from "./client";
import { unexpectedApiError } from "./errors";
import {
  isBoolean,
  isFiniteNumber,
  isNullableString,
  isRecord,
  isString,
  type JsonObject,
} from "./types";

export type CaseStatus = "DRAFT" | "APPROVED" | "DEPRECATED";
export type CaseSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type Dataset = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

export type EvaluationCase = {
  id: string;
  datasetId: string;
  caseKey: string;
  question: string;
  expectedSummary: string | null;
  evidence: JsonObject[];
  requiredElements: string[];
  forbiddenElements: string[];
  tags: string[];
  severity: CaseSeverity;
  requiredForRelease: boolean;
  status: CaseStatus;
};

export type EvaluationCaseInput = {
  case_key: string;
  question: string;
  expected_summary: string | null;
  evidence: JsonObject[];
  required_elements: JsonObject[];
  forbidden_elements: JsonObject[];
  tags: JsonObject[];
  severity: CaseSeverity;
  required_for_release: boolean;
};

export type EvaluationCaseUpdateInput = Omit<EvaluationCaseInput, "case_key">;

export type DatasetVersion = {
  id: string;
  datasetId: string;
  version: number;
  contentHash: string;
  caseCount: number;
  createdAt: string;
};

export type SnapshotCase = {
  id: string;
  sourceEvaluationCaseId: string;
  caseKey: string;
  question: string;
  expectedSummary: string | null;
  evidence: JsonObject[];
  requiredElements: string[];
  forbiddenElements: string[];
  tags: string[];
  severity: CaseSeverity;
  requiredForRelease: boolean;
};

export type DatasetVersionDetail = DatasetVersion & { cases: SnapshotCase[] };

const STATUSES = ["DRAFT", "APPROVED", "DEPRECATED"] as const;
const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

function fail(label: string): never {
  throw unexpectedApiError(`${label} 응답 형식이 올바르지 않습니다.`);
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (!isString(value) || !values.includes(value as T)) fail(label);
  return value as T;
}

function objectArray(value: unknown, label: string): JsonObject[] {
  if (!Array.isArray(value) || !value.every(isRecord)) fail(label);
  return value.map((item) => ({ ...item }));
}

function normalizedStringArray(value: unknown, key: string, label: string): string[] {
  if (!Array.isArray(value)) fail(label);
  return value.map((item) => {
    if (isString(item)) return item;
    if (isRecord(item)) {
      const candidate = item[key];
      if (isString(candidate)) return candidate;
    }
    return fail(label);
  });
}

function dateTime(value: unknown, label: string): string {
  if (!isString(value) || Number.isNaN(Date.parse(value))) fail(label);
  return value;
}

export function parseDataset(value: unknown): Dataset {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.project_id) ||
    !isString(value.name) ||
    !isNullableString(value.description) ||
    !isBoolean(value.is_active)
  ) fail("Dataset");
  return {
    id: value.id,
    projectId: value.project_id,
    name: value.name,
    description: value.description,
    isActive: value.is_active,
  };
}

export function parseEvaluationCase(value: unknown): EvaluationCase {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.dataset_id) ||
    !isString(value.case_key) ||
    !isString(value.question) ||
    !isNullableString(value.expected_summary) ||
    !isBoolean(value.required_for_release)
  ) fail("Evaluation Case");
  return {
    id: value.id,
    datasetId: value.dataset_id,
    caseKey: value.case_key,
    question: value.question,
    expectedSummary: value.expected_summary,
    evidence: objectArray(value.evidence, "Evaluation Case"),
    requiredElements: normalizedStringArray(value.required_elements, "text", "Evaluation Case"),
    forbiddenElements: normalizedStringArray(value.forbidden_elements, "text", "Evaluation Case"),
    tags: normalizedStringArray(value.tags, "name", "Evaluation Case"),
    severity: enumValue(value.severity, SEVERITIES, "Evaluation Case"),
    requiredForRelease: value.required_for_release,
    status: enumValue(value.status, STATUSES, "Evaluation Case"),
  };
}

function parseDatasetVersion(value: unknown): DatasetVersion {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.dataset_id) ||
    !isFiniteNumber(value.version) ||
    !isString(value.content_hash) ||
    !isFiniteNumber(value.case_count)
  ) fail("Dataset Version");
  return {
    id: value.id,
    datasetId: value.dataset_id,
    version: value.version,
    contentHash: value.content_hash,
    caseCount: value.case_count,
    createdAt: dateTime(value.created_at, "Dataset Version"),
  };
}

function parseSnapshotCase(value: unknown): SnapshotCase {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.source_evaluation_case_id) ||
    !isString(value.case_key) ||
    !isString(value.question) ||
    !isNullableString(value.expected_summary) ||
    !isBoolean(value.required_for_release)
  ) fail("Snapshot Case");
  return {
    id: value.id,
    sourceEvaluationCaseId: value.source_evaluation_case_id,
    caseKey: value.case_key,
    question: value.question,
    expectedSummary: value.expected_summary,
    evidence: objectArray(value.evidence, "Snapshot Case"),
    requiredElements: normalizedStringArray(value.required_elements, "text", "Snapshot Case"),
    forbiddenElements: normalizedStringArray(value.forbidden_elements, "text", "Snapshot Case"),
    tags: normalizedStringArray(value.tags, "name", "Snapshot Case"),
    severity: enumValue(value.severity, SEVERITIES, "Snapshot Case"),
    requiredForRelease: value.required_for_release,
  };
}

function parseVersionDetail(value: unknown): DatasetVersionDetail {
  if (!isRecord(value) || !Array.isArray(value.cases)) fail("Dataset Version Detail");
  return { ...parseDatasetVersion(value), cases: value.cases.map(parseSnapshotCase) };
}

function parseDataResponse<T>(value: unknown, parser: (input: unknown) => T) {
  if (!isRecord(value) || !isRecord(value.meta) || !isString(value.meta.request_id)) fail("API");
  return { data: parser(value.data), requestId: value.meta.request_id };
}

export function listDatasets(projectId: string, page = 1, signal?: AbortSignal) {
  return getPaginatedData(`/projects/${encodeURIComponent(projectId)}/datasets?page=${page}&size=20`, parseDataset, signal);
}

export function createDataset(projectId: string, input: { name: string; description: string | null }, signal?: AbortSignal) {
  return request(`/projects/${encodeURIComponent(projectId)}/datasets`, {
    method: "POST", body: input, signal, parse: (value) => parseDataResponse(value, parseDataset),
  });
}

export function getDataset(datasetId: string, signal?: AbortSignal) {
  return getData(`/datasets/${encodeURIComponent(datasetId)}`, parseDataset, signal);
}

export function listEvaluationCases(datasetId: string, page = 1, signal?: AbortSignal) {
  return getPaginatedData(`/datasets/${encodeURIComponent(datasetId)}/evaluation-cases?page=${page}&size=20`, parseEvaluationCase, signal);
}

export function createEvaluationCase(datasetId: string, input: EvaluationCaseInput) {
  return request(`/datasets/${encodeURIComponent(datasetId)}/evaluation-cases`, {
    method: "POST", body: input, parse: (value) => parseDataResponse(value, parseEvaluationCase),
  });
}

export function updateEvaluationCase(caseId: string, input: EvaluationCaseUpdateInput) {
  return request(`/evaluation-cases/${encodeURIComponent(caseId)}`, {
    method: "PATCH", body: input, parse: (value) => parseDataResponse(value, parseEvaluationCase),
  });
}

export function transitionEvaluationCase(caseId: string, action: "approve" | "deprecate") {
  return request(`/evaluation-cases/${encodeURIComponent(caseId)}/${action}`, {
    method: "POST", parse: (value) => parseDataResponse(value, parseEvaluationCase),
  });
}

export function listDatasetVersions(datasetId: string, page = 1, signal?: AbortSignal) {
  return getPaginatedData(`/datasets/${encodeURIComponent(datasetId)}/versions?page=${page}&size=20`, parseDatasetVersion, signal);
}

export function createDatasetVersion(datasetId: string) {
  return request(`/datasets/${encodeURIComponent(datasetId)}/versions`, {
    method: "POST", parse: (value) => parseDataResponse(value, parseDatasetVersion),
  });
}

export function getDatasetVersion(datasetId: string, version: number, signal?: AbortSignal) {
  return getData(`/datasets/${encodeURIComponent(datasetId)}/versions/${version}`, parseVersionDetail, signal);
}
