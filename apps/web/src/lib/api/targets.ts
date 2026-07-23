import { getData, getPaginatedData, request } from "./client";
import { unexpectedApiError } from "./errors";
import { isBoolean, isFiniteNumber, isRecord, isString, type JsonObject } from "./types";

export type Target = { id: string; projectId: string; name: string; targetType: "MOCK"; config: JsonObject; isActive: boolean };
export type TargetVersion = {
  id: string; targetId: string; version: number; contentHash: string; createdAt: string;
  configSnapshot: JsonObject; responseStrategy: "FIXED" | "CASE_BASED" | "SCENARIO_BASED";
  latencyMs: number; failureRate: number;
};
const STRATEGIES = ["FIXED", "CASE_BASED", "SCENARIO_BASED"] as const;
const fail = (): never => { throw unexpectedApiError("Target 응답 형식이 올바르지 않습니다."); };
const object = (value: unknown): JsonObject => isRecord(value) ? { ...value } : fail();
const date = (value: unknown): string => isString(value) && !Number.isNaN(Date.parse(value)) ? value : fail();
function envelope<T>(value: unknown, parser: (input: unknown) => T) {
  const record = isRecord(value) ? value : fail();
  const meta = isRecord(record.meta) ? record.meta : fail();
  const requestId = isString(meta.request_id) ? meta.request_id : fail();
  return { data: parser(record.data), requestId };
}
export function parseTarget(value: unknown): Target {
  const record = isRecord(value) ? value : fail();
  const id = isString(record.id) ? record.id : fail();
  const projectId = isString(record.project_id) ? record.project_id : fail();
  const name = isString(record.name) ? record.name : fail();
  const isActive = isBoolean(record.is_active) ? record.is_active : fail();
  if (record.target_type !== "MOCK") fail();
  return { id, projectId, name, targetType: "MOCK", config: object(record.config), isActive };
}
export function parseTargetVersion(value: unknown): TargetVersion {
  const record = isRecord(value) ? value : fail();
  const id = isString(record.id) ? record.id : fail();
  const targetId = isString(record.target_id) ? record.target_id : fail();
  const version = isFiniteNumber(record.version) ? record.version : fail();
  const contentHash = isString(record.content_hash) ? record.content_hash : fail();
  const strategy = isString(record.response_strategy) && STRATEGIES.includes(record.response_strategy as TargetVersion["responseStrategy"]) ? record.response_strategy as TargetVersion["responseStrategy"] : fail();
  const latencyMs = isFiniteNumber(record.latency_ms) ? record.latency_ms : fail();
  const failureRate = isFiniteNumber(record.failure_rate) ? record.failure_rate : fail();
  return { id, targetId, version, contentHash, createdAt: date(record.created_at), configSnapshot: object(record.config_snapshot), responseStrategy: strategy, latencyMs, failureRate };
}
export const listTargets = (projectId: string, page = 1, signal?: AbortSignal) => getPaginatedData(`/projects/${encodeURIComponent(projectId)}/targets?page=${page}&size=20`, parseTarget, signal);
export const getTarget = (id: string, signal?: AbortSignal) => getData(`/targets/${encodeURIComponent(id)}`, parseTarget, signal);
export const createTarget = (projectId: string, name: string, fixedResponse: string) => request(`/projects/${encodeURIComponent(projectId)}/targets`, { method: "POST", body: { name, target_type: "MOCK", config: { fixed_response: { text: fixedResponse } } }, parse: (value) => envelope(value, parseTarget) });
export const updateTarget = (id: string, input: { name?: string; fixedResponse?: string; isActive?: false }) => {
  const body = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.fixedResponse !== undefined ? { config: { fixed_response: { text: input.fixedResponse } } } : {}),
    ...(input.isActive === false ? { is_active: false } : {}),
  };

  return request(`/targets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
    parse: (value) => envelope(value, parseTarget),
  });
};
export const listTargetVersions = (id: string, page = 1, signal?: AbortSignal) => getPaginatedData(`/targets/${encodeURIComponent(id)}/versions?page=${page}&size=20`, parseTargetVersion, signal);
export const createTargetVersion = (id: string) => request(`/targets/${encodeURIComponent(id)}/versions`, { method: "POST", parse: (value) => envelope(value, parseTargetVersion) });
export const getTargetVersion = (id: string, version: number, signal?: AbortSignal) => getData(`/targets/${encodeURIComponent(id)}/versions/${version}`, parseTargetVersion, signal);
export function fixedResponse(config: JsonObject): string | null {
  const fixed = config.fixed_response;
  return isRecord(fixed) && isString(fixed.text) ? fixed.text : null;
}
