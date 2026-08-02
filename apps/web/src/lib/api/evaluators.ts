import { getData, getPaginatedData, request } from "./client";
import { unexpectedApiError } from "./errors";
import { isBoolean, isFiniteNumber, isRecord, isString, type JsonObject } from "./types";

export type EvaluatorType = "CONTAINS" | "NOT_CONTAINS" | "REGEX";
export type Evaluator = { id: string; projectId: string; name: string; evaluatorType: EvaluatorType; config: JsonObject; isActive: boolean; createdAt: string; updatedAt: string };
export type EvaluatorVersion = { id: string; evaluatorId: string; version: number; contentHash: string; evaluatorTypeSnapshot: EvaluatorType; configSnapshot: JsonObject; createdAt: string };
export type EvaluatorConfigInput = { text: string; caseSensitive: boolean; flags: string[] };
const TYPES = ["CONTAINS", "NOT_CONTAINS", "REGEX"] as const;
const fail = (): never => { throw unexpectedApiError("Evaluator 응답 형식이 올바르지 않습니다."); };
const date = (value: unknown): string => isString(value) && !Number.isNaN(Date.parse(value)) ? value : fail();
const object = (value: unknown): JsonObject => isRecord(value) ? { ...value } : fail();
const type = (value: unknown): EvaluatorType => isString(value) && TYPES.includes(value as EvaluatorType) ? value as EvaluatorType : fail();
function envelope<T>(value: unknown, parser: (input: unknown) => T) {
  const record = isRecord(value) ? value : fail();
  const meta = isRecord(record.meta) ? record.meta : fail();
  const requestId = isString(meta.request_id) ? meta.request_id : fail();
  return { data: parser(record.data), requestId };
}
export function parseEvaluator(value: unknown): Evaluator {
  const record = isRecord(value) ? value : fail();
  const id = isString(record.id) ? record.id : fail();
  const projectId = isString(record.project_id) ? record.project_id : fail();
  const name = isString(record.name) ? record.name : fail();
  const isActive = isBoolean(record.is_active) ? record.is_active : fail();
  return { id, projectId, name, evaluatorType: type(record.evaluator_type), config: object(record.config), isActive, createdAt: date(record.created_at), updatedAt: date(record.updated_at) };
}
export function parseEvaluatorVersion(value: unknown): EvaluatorVersion {
  const record = isRecord(value) ? value : fail();
  const id = isString(record.id) ? record.id : fail();
  const evaluatorId = isString(record.evaluator_id) ? record.evaluator_id : fail();
  const version = isFiniteNumber(record.version) ? record.version : fail();
  const contentHash = isString(record.content_hash) ? record.content_hash : fail();
  return { id, evaluatorId, version, contentHash, evaluatorTypeSnapshot: type(record.evaluator_type_snapshot), configSnapshot: object(record.config_snapshot), createdAt: date(record.created_at) };
}
export function evaluatorConfig(evaluatorType: EvaluatorType, input: EvaluatorConfigInput): JsonObject {
  if (evaluatorType === "CONTAINS") return { expected: input.text, case_sensitive: input.caseSensitive };
  if (evaluatorType === "NOT_CONTAINS") return { forbidden: input.text, case_sensitive: input.caseSensitive };
  return { pattern: input.text, flags: [...input.flags] };
}
export function configInput(type: EvaluatorType, config: JsonObject): EvaluatorConfigInput {
  const key = type === "CONTAINS" ? "expected" : type === "NOT_CONTAINS" ? "forbidden" : "pattern";
  const value = config[key];
  const flags = Array.isArray(config.flags) && config.flags.every(isString) ? [...config.flags] : [];
  return { text: isString(value) ? value : "", caseSensitive: config.case_sensitive === true, flags };
}
export const listEvaluators = (projectId: string, page = 1, signal?: AbortSignal) => getPaginatedData(`/projects/${encodeURIComponent(projectId)}/evaluators?page=${page}&size=20`, parseEvaluator, signal);
export const getEvaluator = (id: string, signal?: AbortSignal) => getData(`/evaluators/${encodeURIComponent(id)}`, parseEvaluator, signal);
export const createEvaluator = (projectId: string, name: string, evaluatorType: EvaluatorType, input: EvaluatorConfigInput) => request(`/projects/${encodeURIComponent(projectId)}/evaluators`, { method: "POST", body: { name, evaluator_type: evaluatorType, config: evaluatorConfig(evaluatorType, input) }, parse: (value) => envelope(value, parseEvaluator) });
export const updateEvaluator = (id: string, type: EvaluatorType, input: { name?: string; config?: EvaluatorConfigInput; isActive?: false }) => request(`/evaluators/${encodeURIComponent(id)}`, { method: "PATCH", body: { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.config ? { config: evaluatorConfig(type, input.config) } : {}), ...(input.isActive === false ? { is_active: false } : {}) }, parse: (value) => envelope(value, parseEvaluator) });
export const listEvaluatorVersions = (id: string, page = 1, signal?: AbortSignal) => getPaginatedData(`/evaluators/${encodeURIComponent(id)}/versions?page=${page}&size=20`, parseEvaluatorVersion, signal);
export const createEvaluatorVersion = (id: string) => request(`/evaluators/${encodeURIComponent(id)}/versions`, { method: "POST", parse: (value) => envelope(value, parseEvaluatorVersion) });
export const getEvaluatorVersion = (id: string, version: number, signal?: AbortSignal) => getData(`/evaluators/${encodeURIComponent(id)}/versions/${version}`, parseEvaluatorVersion, signal);
export const getEvaluatorVersionById = (id: string, signal?: AbortSignal) => getData(`/evaluator-versions/${encodeURIComponent(id)}`, parseEvaluatorVersion, signal);
