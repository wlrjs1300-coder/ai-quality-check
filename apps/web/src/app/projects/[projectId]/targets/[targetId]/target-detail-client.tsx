"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import { StatusBadge } from "@/src/components/StatusBadge";
import { createTargetVersion, fixedResponse, getTarget, listTargetVersions, updateTarget, type Target, type TargetVersion } from "@/src/lib/api/targets";
import { ApiError, toApiError } from "@/src/lib/api/errors";
import { formatLocalDateTime, shortId } from "@/src/lib/formatters";

function targetNotFoundError(): ApiError {
  return new ApiError({
    kind: "application",
    status: 404,
    code: "TARGET_NOT_FOUND",
    message: "Target을 찾을 수 없습니다.",
    retryable: false,
  });
}

export function TargetDetailClient({
  projectId,
  targetId,
}: {
  projectId: string;
  targetId: string;
}) {
  const [target, setTarget] = useState<Target | null>(null);
  const [versions, setVersions] = useState<TargetVersion[]>([]);
  const [name, setName] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [versionError, setVersionError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versioning, setVersioning] = useState(false);
  const [versionLoading, setVersionLoading] = useState(true);
  const [versionRefreshing, setVersionRefreshing] = useState(false);
  const [versionPage, setVersionPage] = useState(1);
  const [versionTotal, setVersionTotal] = useState(0);
  const [versionSize] = useState(20);

  const versionControllerRef = useRef<AbortController | null>(null);
  const versionRequestIdRef = useRef(0);

  const loadTarget = useCallback(async () => {
    try {
      setError(null);
      const item = (await getTarget(targetId)).data;
      if (item.projectId !== projectId) {
        setError(targetNotFoundError());
        return;
      }
      setTarget(item);
      setName(item.name);
      setResponse(fixedResponse(item.config) ?? "");
    } catch (loadError) {
      setError(toApiError(loadError));
    }
  }, [targetId, projectId]);

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
        const result = await listTargetVersions(targetId, requestPage, controller.signal);
        if (requestId !== versionRequestIdRef.current || versionControllerRef.current !== controller) {
          return;
        }

        const totalPages = result.pagination.total === 0 ? 0 : Math.ceil(result.pagination.total / versionSize);
        if (result.pagination.total > 0 && requestPage > totalPages) {
          const clampedPage = Math.max(1, totalPages);
          setVersionTotal(result.pagination.total);
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
    [targetId, versionSize],
  );

  useEffect(() => {
    setLoading(true);
    void Promise.allSettled([loadTarget(), loadVersions(1)]).finally(() => setLoading(false));
  }, [loadTarget, loadVersions]);

  useEffect(() => {
    return () => {
      versionControllerRef.current?.abort();
      versionControllerRef.current = null;
    };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!target?.isActive || saving) return;

    const nextName = name.trim();
    const nextResponse = response.trim();
    if (!nextName || !nextResponse) return;

    setSaving(true);
    setError(null);
    try {
      await updateTarget(targetId, {
        ...(nextName !== target.name ? { name: nextName } : {}),
        fixedResponse: nextResponse,
      });
      await loadTarget();
    } catch (saveError) {
      setError(toApiError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!target?.isActive || saving || !window.confirm("비활성화 후 재활성화할 수 없습니다. 계속하시겠습니까?")) {
      return;
    }
    setSaving(true);
    try {
      await updateTarget(targetId, { isActive: false });
      await loadTarget();
      await loadVersions(versionPage, true);
    } catch (deactivateError) {
      setError(toApiError(deactivateError));
    } finally {
      setSaving(false);
    }
  }

  async function snapshot() {
    if (!target?.isActive || versioning) return;

    setVersioning(true);
    setVersionError(null);
    try {
      await createTargetVersion(targetId);
      await loadVersions(versionPage, true);
    } catch (snapshotError) {
      setVersionError(toApiError(snapshotError));
    } finally {
      setVersioning(false);
    }
  }

  function loadVersionPage(nextPage: number) {
    void loadVersions(nextPage, true);
  }

  const totalPages = versionTotal === 0 ? 0 : Math.ceil(versionTotal / versionSize);

  if (loading && !target) {
    return (
      <main className="app-shell">
        <LoadingState title="Target을 불러오고 있습니다" />
      </main>
    );
  }

  if (error && !target) {
    const isNotFound = error.status === 404 || error.code === "TARGET_NOT_FOUND";
    return (
      <main className="app-shell">
        <ErrorState
          title={error.kind === "network" ? "서버에 연결할 수 없습니다" : undefined}
          message={isNotFound ? "Target을 찾을 수 없습니다." : error.message}
          retryable={error.retryable}
          onRetry={() => void loadTarget()}
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
      <nav className="breadcrumb">
        <Link href={`/projects/${projectId}`}>Project Overview</Link>
        <span>/</span>
        <span>Target</span>
      </nav>
      {target ? (
        <>
          <header className="detail-header">
            <div>
              <p className="eyebrow">MOCK Target</p>
              <h1>{target.name}</h1>
              <p className="page-description">FIXED 응답 설정과 불변 Version Snapshot을 관리합니다.</p>
            </div>
            <StatusBadge active={target.isActive} />
          </header>

          <form className="form-panel case-form" onSubmit={(event) => void save(event)}>
            <label>
              이름
              <input
                value={name}
                disabled={!target.isActive || saving}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label>
              고정 응답
              <textarea
                value={response}
                disabled={!target.isActive || saving}
                onChange={(event) => setResponse(event.target.value)}
                required
              />
            </label>
            {error ? (
              <p className="form-error">
                {error.code === "DUPLICATE_TARGET_NAME_IN_PROJECT"
                  ? "같은 이름의 Target이 이미 있습니다."
                  : error.code === "TARGET_INACTIVE"
                    ? "비활성 Target은 수정할 수 없습니다."
                    : error.message}
              </p>
            ) : null}
            <div className="form-actions">
              <button
                className="button button-danger"
                type="button"
                disabled={!target.isActive || saving}
                onClick={() => void deactivate()}
              >
                비활성화
              </button>
              <button
                className="button"
                disabled={!target.isActive || saving || !name.trim() || !response.trim()}
              >
                {saving ? "저장 중…" : "설정 저장"}
              </button>
            </div>
          </form>

          {!target.isActive ? (
            <p className="immutable-note">비활성 Target은 조회만 가능하며 재활성화하거나 새 Version을 만들 수 없습니다. 기존 Version은 유지됩니다.</p>
          ) : null}

          <section className="overview-section">
            <div className="section-heading">
              <h2>Target Versions</h2>
              <button className="button" disabled={!target.isActive || versioning} onClick={() => void snapshot()}>
                {versioning ? "생성 중…" : "Version 생성"}
              </button>
            </div>

            {versionError ? (
              <ErrorState
                title={versionError.kind === "network" ? "서버에 연결할 수 없습니다" : undefined}
                message={versionError.code === "DUPLICATE_TARGET_VERSION"
                  ? "같은 Target Snapshot이 이미 있습니다."
                  : versionError.message}
                retryable={versionError.retryable}
                onRetry={() => void loadVersions(versionPage, true)}
              />
            ) : null}
            {versionLoading && versions.length === 0 ? <LoadingState title="Version을 불러오고 있습니다" /> : null}
            {!versionLoading && !versionError && versions.length === 0 ? <p className="empty-inline">Version이 없습니다.</p> : null}

            <div className="version-list">
              {versions.map((v) => (
                <article className="version-card" key={v.id}>
                  <div>
                    <p className="eyebrow">Version {v.version}</p>
                    <strong>{v.responseStrategy}</strong>
                  </div>
                  <code title={v.contentHash}>{shortId(v.contentHash)}</code>
                  <span>
                    {v.latencyMs}ms · 실패율 {(v.failureRate * 100).toFixed(2)}%
                    <br />
                    {formatLocalDateTime(v.createdAt)}
                  </span>
                  <Link className="button button-secondary" href={`/projects/${projectId}/targets/${targetId}/versions/${v.version}`}>
                    상세
                  </Link>
                </article>
              ))}
            </div>

            {totalPages > 0 ? (
              <nav className="pagination" aria-label="Target Version 페이지 이동">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={versionPage <= 1 || versionRefreshing}
                  onClick={() => void loadVersionPage(versionPage - 1)}
                >
                  이전
                </button>
                <span>{`전체 ${versionTotal}건 · ${versionPage} / ${totalPages || 0} 페이지`}</span>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={totalPages === 0 || versionPage >= totalPages || versionRefreshing}
                  onClick={() => void loadVersionPage(versionPage + 1)}
                >
                  다음
                </button>
              </nav>
            ) : null}

            <p className="immutable-note">Version은 생성 당시 설정을 보존하며 수정·삭제할 수 없습니다.</p>
          </section>
        </>
      ) : null}
    </main>
  );
}
