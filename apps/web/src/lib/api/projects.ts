import { getData, getPaginatedData, request } from "./client";
import { unexpectedApiError } from "./errors";
import {
  isBoolean,
  isNullableString,
  isRecord,
  isString,
  type PaginatedResult,
} from "./types";

export type Project = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ProjectCreateInput = {
  slug: string;
  name: string;
  description: string | null;
};

function optionalDate(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isString(value) || Number.isNaN(Date.parse(value))) {
    throw unexpectedApiError("Project datetime 형식이 올바르지 않습니다.");
  }
  return value;
}

export function parseProject(value: unknown): Project {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.slug) ||
    !isString(value.name) ||
    !isNullableString(value.description) ||
    !isBoolean(value.is_active)
  ) {
    throw unexpectedApiError("Project 응답 형식이 올바르지 않습니다.");
  }

  return {
    id: value.id,
    slug: value.slug,
    name: value.name,
    description: value.description,
    isActive: value.is_active,
    createdAt: optionalDate(value.created_at),
    updatedAt: optionalDate(value.updated_at),
  };
}

export function listProjects(signal?: AbortSignal): Promise<PaginatedResult<Project>> {
  return getPaginatedData("/projects?page=1&size=20", parseProject, signal);
}

export function getProject(projectId: string, signal?: AbortSignal) {
  return getData(`/projects/${encodeURIComponent(projectId)}`, parseProject, signal);
}

export function createProject(input: ProjectCreateInput, signal?: AbortSignal) {
  return request("/projects", {
    method: "POST",
    body: input,
    signal,
    parse(value) {
      if (!isRecord(value) || !isRecord(value.meta) || !isString(value.meta.request_id)) {
        throw unexpectedApiError();
      }
      return { data: parseProject(value.data), requestId: value.meta.request_id };
    },
  });
}
