"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import { Breadcrumb } from "@/src/components/Breadcrumb";
import { PageHeader } from "@/src/components/PageHeader";
import { Pagination } from "@/src/components/Pagination";
import { StatusBadge } from "@/src/components/StatusBadge";
import {
  configInput,
  createEvaluatorVersion,
  getEvaluator,
  listEvaluatorVersions,
  updateEvaluator,
  type Evaluator,
  type EvaluatorConfigInput,
  type EvaluatorVersion,
} from "@/src/lib/api/evaluators";
import { ApiError, toApiError } from "@/src/lib/api/errors";
import { formatLocalDateTime, shortId } from "@/src/lib/formatters";

const FLAGS = ["IGNORECASE", "MULTILINE", "DOTALL"] as const;

function evaluatorNotFoundError(): ApiError {
  return new ApiError({
    kind: "application",
    status: 404,
    code: "EVALUATOR_NOT_FOUND",
    message: "Evaluator를 찾을 수 없습니다.",
    retryable: false,
  });
}

export function EvaluatorDetailClient({
  projectId,
  evaluatorId,
}: {
  projectId: string;
  evaluatorId: string;
}) {
  const [item, setItem] = useState<Evaluator | null>(null);
  const [versions, setVersions] = useState<EvaluatorVersion[]>([]);
  const [name, setName] = useState("");
  const [input, setInput] = useState<EvaluatorConfigInput>({
    text: "",
    caseSensitive: false,
    flags: [],
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [versionError, setVersionError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versioning, setVersioning] = useState(false);
  const [versionLoading, setVersionLoading] = useState(true);
  const [versionRefreshing, setVersionRefreshing] = useState(false);
  const [versionPage, setVersionPage] = useState(1);
  const [versionTotal, setVersionTotal] = useState(0);
  const [versionSize, setVersionSize] = useState(20);
  const versionControllerRef = useRef<AbortController | null>(null);
  const versionRequestIdRef = useRef(0);

  const loadItem = useCallback(async () => {
    try {
      setError(null);
      const value = (await getEvaluator(evaluatorId)).data;
      if (value.projectId !== projectId) {
        setError(evaluatorNotFoundError());
        return;
      }
      setItem(value);
      setName(value.name);
      setInput(configInput(value.evaluatorType, value.config));
    } catch (loadError) {
      setError(toApiError(loadError));
    }
  }, [evaluatorId, projectId]);

  const loadVersions = useCallback(
    async (nextPage = 1, retainData = false): Promise<void> => {
      const requestId = ++versionRequestIdRef.current;
      versionControllerRef.current?.abort();
      const controller = new AbortController();
      versionControllerRef.current = controller;
      const requestPage = Math.max(1, nextPage);

      if (retainData) setVersionRefreshing(true);
      else setVersionLoading(true);
      setVersionError(null);

      try {
        const result = await listEvaluatorVersions(evaluatorId, requestPage, controller.signal);

        if (requestId !== versionRequestIdRef.current || versionControllerRef.current !== controller) {
          return;
        }

        const responseSize = Math.max(1, result.pagination.size);
        const totalPages = result.pagination.total === 0
          ? 0
          : Math.ceil(result.pagination.total / responseSize);
        setVersionSize(responseSize);
        if (result.pagination.total > 0 && requestPage > totalPages) {
          setVersionTotal(result.pagination.total);
          const clampedPage = Math.max(1, totalPages);
          setVersionPage(clampedPage);
          setVersions([]);
          await loadVersions(clampedPage, retainData);
          return;
        }

        setVersions(result.data);
        setVersionTotal(result.pagination.total);
        setVersionPage(result.pagination.page);
      } catch (versionLoadError) {
        if (versionControllerRef.current !== controller) {
          return;
        }
        if (versionLoadError instanceof DOMException && versionLoadError.name === "AbortError") {
          return;
        }
        setVersionError(toApiError(versionLoadError));
      } finally {
        if (requestId === versionRequestIdRef.current && versionControllerRef.current === controller) {
          setVersionLoading(false);
          setVersionRefreshing(false);
          versionControllerRef.current = null;
        }
      }
    },
    [evaluatorId],
  );

  useEffect(() => {
    setLoading(true);
    void Promise.allSettled([loadItem(), loadVersions(1)]).finally(() => setLoading(false));
  }, [loadItem, loadVersions]);

  useEffect(() => {
    return () => {
      versionControllerRef.current?.abort();
      versionControllerRef.current = null;
    };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!item?.isActive || !input.text.trim() || saving) return;

    setSaving(true);
    try {
      await updateEvaluator(evaluatorId, item.evaluatorType, {
        name: name.trim(),
        config: { ...input, text: input.text.trim() },
      });
      await loadItem();
    } catch (saveError) {
      setError(toApiError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!item?.isActive || saving || !window.confirm("비활성화 후 재활성화할 수 없습니다. 계속하시겠습니까?")) {
      return;
    }

    setSaving(true);
    try {
      await updateEvaluator(evaluatorId, item.evaluatorType, { isActive: false });
      await loadItem();
      await loadVersions(versionPage, true);
    } catch (deactivateError) {
      setError(toApiError(deactivateError));
    } finally {
      setSaving(false);
    }
  }

  async function snapshot() {
    if (!item?.isActive || versioning) return;

    setVersioning(true);
    setVersionError(null);
    try {
      await createEvaluatorVersion(evaluatorId);
      setVersionPage(1);
      await loadVersions(1, true);
    } catch (snapshotError) {
      setVersionError(toApiError(snapshotError));
    } finally {
      setVersioning(false);
    }
  }

  function loadVersionPage(nextPage: number) {
    void loadVersions(nextPage, true);
  }

  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: "Projects", href: "/projects" },
        { label: "Project Overview", href: `/projects/${projectId}` },
        { label: item?.name ?? "Evaluator" },
      ]}
    />
  );

  if (loading && !item) {
    return (
      <main className="app-shell">
        {breadcrumb}
        <PageHeader title="Evaluator" />
        <LoadingState />
      </main>
    );
  }

  if (error && !item) {
    const isNotFound = error.status === 404 || error.code === "EVALUATOR_NOT_FOUND";
    return (
      <main className="app-shell">
        {breadcrumb}
        <PageHeader title="Evaluator" />
        <ErrorState
          title={error.kind === "network" ? "서버에 연결할 수 없습니다" : undefined}
          message={isNotFound ? "Evaluator를 찾을 수 없습니다." : error.message}
          retryable={error.retryable}
          onRetry={() => void loadItem()}
        />
        {isNotFound ? (
          <div className="detail-actions">
            <Link className="button button-secondary" href={`/projects/${projectId}`}>
              Project Overview로 돌아가기
            </Link>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="app-shell">
      {breadcrumb}

      {item ? (
        <>
          <PageHeader
            eyebrow={item.evaluatorType}
            title={item.name}
            description="결정론적 설정과 불변 Version Snapshot을 관리합니다."
            status={<StatusBadge active={item.isActive} />}
          />

          <form className="form-panel case-form" onSubmit={(event) => void save(event)}>
            <label>
              이름
              <input
                value={name}
                disabled={!item.isActive || saving}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label>
              {item.evaluatorType === "CONTAINS"
                ? "포함해야 할 문자열"
                : item.evaluatorType === "NOT_CONTAINS"
                  ? "포함하면 안 되는 문자열"
                  : "Regex Pattern"}
              <input
                value={input.text}
                disabled={!item.isActive || saving}
                onChange={(event) => setInput((current) => ({ ...current, text: event.target.value }))}
                required
              />
            </label>
            {item.evaluatorType === "REGEX" ? (
              <fieldset className="inline-fieldset">
                <legend>Flags</legend>
                {FLAGS.map((flag) => (
                  <label className="checkbox-label" key={flag}>
                    <input
                      type="checkbox"
                      disabled={!item.isActive || saving}
                      checked={input.flags.includes(flag)}
                      onChange={(event) => {
                        setInput((current) => ({
                          ...current,
                          flags: event.target.checked
                            ? [...current.flags, flag]
                            : current.flags.filter((value) => value !== flag),
                        }));
                      }}
                    />
                    {flag}
                  </label>
                ))}
              </fieldset>
            ) : (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  disabled={!item.isActive || saving}
                  checked={input.caseSensitive}
                  onChange={(event) => setInput((current) => ({ ...current, caseSensitive: event.target.checked }))}
                />
                대소문자 구분
              </label>
            )}

            {error ? (
              <p className="form-error">
                {error.code === "DUPLICATE_EVALUATOR_NAME_IN_PROJECT"
                  ? "같은 이름이 이미 있습니다."
                  : error.code === "EVALUATOR_INACTIVE"
                    ? "비활성 Evaluator는 수정할 수 없습니다."
                    : error.message}
              </p>
            ) : null}
            <div className="form-actions">
              <button
                type="button"
                className="button button-danger"
                disabled={!item.isActive || saving}
                onClick={() => void deactivate()}
              >
                비활성화
              </button>
              <button
                className="button"
                disabled={!item.isActive || saving || !name.trim() || !input.text.trim()}
              >
                {saving ? "저장 중…" : "설정 저장"}
              </button>
            </div>
          </form>

          {!item.isActive ? (
            <p className="immutable-note">비활성 Evaluator는 조회만 가능하며 재활성화하거나 새 Version을 만들 수 없습니다. 기존 Version은 유지됩니다.</p>
          ) : null}

          <section className="overview-section">
            <div className="section-heading">
              <h2>Evaluator Versions</h2>
              <button className="button" disabled={!item.isActive || versioning} onClick={() => void snapshot()}>
                {versioning ? "생성 중…" : "Version 생성"}
              </button>
            </div>

            {versionError ? (
              <ErrorState
                title={versionError.kind === "network" ? "서버에 연결할 수 없습니다" : undefined}
                message={versionError.code === "DUPLICATE_EVALUATOR_VERSION"
                  ? "같은 Snapshot이 이미 있습니다."
                  : versionError.message}
                retryable={versionError.retryable}
                onRetry={() => void loadVersions(versionPage, true)}
              />
            ) : null}
            {versionLoading && versions.length === 0 ? <LoadingState title="Version을 불러오고 있습니다" /> : null}
            {!versionLoading && !versionError && versions.length === 0 ? <p className="empty-inline">Version이 없습니다.</p> : null}

            <div className="version-list">
              {versions.map((version) => (
                <article className="version-card" key={version.id}>
                  <div>
                    <p className="eyebrow">Version {version.version}</p>
                    <strong>{version.evaluatorTypeSnapshot}</strong>
                  </div>
                  <code title={version.contentHash}>{shortId(version.contentHash)}</code>
                  <span>{formatLocalDateTime(version.createdAt)}</span>
                  <Link
                    className="button button-secondary"
                    href={`/projects/${projectId}/evaluators/${evaluatorId}/versions/${version.version}`}
                  >
                    상세
                  </Link>
                </article>
              ))}
            </div>

            {versionTotal > 0 ? (
              <Pagination
                page={versionPage}
                pageSize={versionSize}
                total={versionTotal}
                onPageChange={loadVersionPage}
                isLoading={versionRefreshing}
                ariaLabel="Evaluator versions pagination"
              />
            ) : null}

            <p className="immutable-note">Version은 생성 당시 Type과 Config를 보존합니다.</p>
          </section>
        </>
      ) : null}
    </main>
  );
}
