"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { ErrorState, LoadingState } from "./AsyncStates";
import { StatusBadge } from "./StatusBadge";
import { createTarget, fixedResponse, listTargets, type Target } from "@/src/lib/api/targets";
import { toApiError, type ApiError } from "@/src/lib/api/errors";

export function TargetRegistry({
  projectId,
  projectActive,
}: {
  projectId: string;
  projectActive: boolean;
}) {
  const [items, setItems] = useState<Target[]>([]);
  const [name, setName] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const size = 20;
  const [total, setTotal] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const hasDataRef = useRef(false);

  const load = useCallback(
    async (nextPage = 1, retainData = false): Promise<void> => {
      const requestId = ++requestIdRef.current;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      if (retainData) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const requestPage = Math.max(1, nextPage);
        const result = await listTargets(projectId, requestPage, controller.signal);

        if (requestId !== requestIdRef.current || controllerRef.current !== controller) {
          return;
        }

        const nextSize = Math.max(1, result.pagination.size);
        const totalPages = result.pagination.total === 0 ? 0 : Math.ceil(result.pagination.total / nextSize);

        if (result.pagination.total > 0 && requestPage > totalPages) {
          setTotal(result.pagination.total);
          const clampedPage = Math.max(1, totalPages);
          setItems([]);
          setPage(clampedPage);
          await load(clampedPage, retainData);
          return;
        }

        setItems(result.data);
        setTotal(result.pagination.total);
        setPage(result.pagination.page);
        hasDataRef.current = result.data.length > 0 || hasDataRef.current;
      } catch (listError) {
        if (controllerRef.current !== controller) {
          return;
        }
        if (listError instanceof DOMException && listError.name === "AbortError") {
          return;
        }
        setError(toApiError(listError));
      } finally {
        if (requestId === requestIdRef.current && controllerRef.current === controller) {
          setLoading(false);
          setRefreshing(false);
          controllerRef.current = null;
        }
      }
    },
    [projectId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !response.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await createTarget(projectId, name.trim(), response.trim());
      setName("");
      setResponse("");
      await load(1, true);
    } catch (submitError) {
      setFormError(toApiError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  function goTo(nextPage: number) {
    void load(nextPage, hasDataRef.current);
  }

  const totalPages = total === 0 ? 0 : Math.ceil(total / size);

  return (
    <section className="overview-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Registry</p>
          <h2>MOCK Targets</h2>
        </div>
        <span>{refreshing ? "갱신 중…" : `${items.length}건 / ${total}건`}</span>
      </div>
      <form className="form-panel compact-form" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <label>
            Target 이름
            <input
              value={name}
              maxLength={120}
              disabled={!projectActive || submitting}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label>
            고정 응답
            <input
              value={response}
              disabled={!projectActive || submitting}
              onChange={(event) => setResponse(event.target.value)}
              required
            />
          </label>
        </div>
        <p className="muted">현재 MOCK + FIXED 응답만 구성합니다.</p>
        {formError ? (
          <p className="form-error" role="alert">
            {formError.code === "DUPLICATE_TARGET_NAME_IN_PROJECT"
              ? "같은 이름의 Target이 이미 있습니다."
              : formError.message}
          </p>
        ) : null}
        <div className="form-actions">
          <button
            className="button"
            disabled={!projectActive || submitting || !name.trim() || !response.trim()}
          >
            {submitting ? "생성 중…" : "Target 생성"}
          </button>
        </div>
      </form>

      {loading && items.length === 0 ? <LoadingState title="Target 목록을 불러오고 있습니다" /> : null}
      {error && items.length === 0 ? (
        <ErrorState
          title={error.kind === "network" ? "서버에 연결할 수 없습니다" : undefined}
          message={error.message}
          retryable={error.retryable}
          onRetry={() => void load(page)}
        />
      ) : null}
      {error && items.length > 0 ? (
        <p className="field-error" role="alert">
          목록 갱신 실패: {error.message}
        </p>
      ) : null}
      {!loading && !error && items.length === 0 ? <p className="empty-inline">등록된 Target이 없습니다.</p> : null}

      <div className="registry-grid">
        {items.map((item) => (
          <article className="dataset-card" key={item.id}>
            <div className="card-heading">
              <h3>{item.name}</h3>
              <StatusBadge active={item.isActive} />
            </div>
            <p>
              <strong>{item.targetType}</strong> · FIXED
            </p>
            <p className="card-description">{fixedResponse(item.config) ?? "고정 응답 설정 없음"}</p>
            <Link className="card-link" href={`/projects/${projectId}/targets/${item.id}`}>
              Target 상세 <span>→</span>
            </Link>
          </article>
        ))}
      </div>

      {totalPages > 0 ? (
        <nav className="pagination" aria-label="Target 목록 페이지 이동">
          <button
            className="button button-secondary"
            type="button"
            disabled={page <= 1 || refreshing}
            onClick={() => void goTo(page - 1)}
          >
            이전
          </button>
          <span>{`전체 ${total}건 · ${page} / ${totalPages || 0} 페이지`}</span>
          <button
            className="button button-secondary"
            type="button"
            disabled={totalPages === 0 || page >= totalPages || refreshing}
            onClick={() => void goTo(page + 1)}
          >
            다음
          </button>
        </nav>
      ) : null}
    </section>
  );
}
