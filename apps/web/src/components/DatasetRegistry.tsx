"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { ErrorState, LoadingState } from "./AsyncStates";
import { StatusBadge } from "./StatusBadge";
import { createDataset, listDatasets, type Dataset } from "@/src/lib/api/datasets";
import { toApiError, type ApiError } from "@/src/lib/api/errors";

export function DatasetRegistry({ projectId, projectActive }: { projectId: string; projectActive: boolean }) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const size = 20;

  const load = useCallback(async (requestedPage = 1, retainData = false): Promise<void> => {
    const requestId = ++requestIdRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    if (retainData) setRefreshing(true);
    else setLoading(true);
    try {
      const normalizedPage = Math.max(1, requestedPage);
      const result = await listDatasets(projectId, normalizedPage, controller.signal);
      if (requestId !== requestIdRef.current || controllerRef.current !== controller) return;

      const responseSize = Math.max(1, result.pagination.size);
      const responseTotalPages = result.pagination.total === 0
        ? 0
        : Math.ceil(result.pagination.total / responseSize);

      if (result.pagination.total > 0 && normalizedPage > responseTotalPages) {
        setTotal(result.pagination.total);
        await load(responseTotalPages, retainData);
        return;
      }

      setDatasets(result.data);
      setPage(result.pagination.total === 0 ? 1 : result.pagination.page);
      setTotal(result.pagination.total);
      hasLoadedRef.current = true;
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      if (requestId === requestIdRef.current && controllerRef.current === controller) {
        setError(toApiError(loadError));
      }
    } finally {
      if (requestId === requestIdRef.current && controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [projectId]);

  useEffect(() => {
    void load(1);
    return () => {
      requestIdRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createDataset(projectId, { name: name.trim(), description: description.trim() || null });
      setName("");
      setDescription("");
      setPage(1);
      await load(1, true);
    } catch (submitError) {
      setFormError(toApiError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  function movePage(nextPage: number) {
    void load(nextPage, hasLoadedRef.current);
  }

  const totalPages = total === 0 ? 0 : Math.ceil(total / size);

  return (
    <section className="overview-section" aria-labelledby="dataset-registry-title">
      <div className="section-heading">
        <div><p className="eyebrow">Registry</p><h2 id="dataset-registry-title">Datasets</h2></div>
        {refreshing ? <span className="count-label" aria-live="polite">갱신 중…</span> : <span className="count-label">전체 {total}건</span>}
      </div>
      <form className="form-panel compact-form" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <label>Dataset 이름<input value={name} maxLength={180} disabled={!projectActive || submitting} onChange={(event) => setName(event.target.value)} required /></label>
          <label>설명<input value={description} disabled={!projectActive || submitting} onChange={(event) => setDescription(event.target.value)} /></label>
        </div>
        {!projectActive ? <p className="form-error">비활성 Project에는 Dataset을 생성할 수 없습니다.</p> : null}
        {formError ? <p className="form-error" role="alert">{formError.code === "DUPLICATE_DATASET_NAME_IN_PROJECT" ? "같은 이름의 Dataset이 이미 있습니다." : formError.message}</p> : null}
        <div className="form-actions"><button className="button" disabled={!projectActive || submitting || !name.trim()}>{submitting ? "생성 중…" : "Dataset 생성"}</button></div>
      </form>
      {loading && !hasLoadedRef.current ? <LoadingState title="Dataset 목록을 불러오고 있습니다" /> : null}
      {error && !hasLoadedRef.current ? <ErrorState message={error.message} retryable={error.retryable} onRetry={() => void load(page)} /> : null}
      {error && hasLoadedRef.current ? (
        <p className="field-error" role="alert">
          목록 갱신 실패: {error.message}{" "}
          <button className="text-button" type="button" onClick={() => void load(page, true)}>
            다시 시도
          </button>
        </p>
      ) : null}
      {!loading && !error && datasets.length === 0 ? <p className="empty-inline">등록된 Dataset이 없습니다.</p> : null}
      {datasets.length > 0 ? (
        <div className="dataset-grid">
          {datasets.map((dataset) => (
            <article className="dataset-card" key={dataset.id}>
              <div className="card-heading"><h3>{dataset.name}</h3><StatusBadge active={dataset.isActive} /></div>
              <p className="card-description">{dataset.description || "설명이 없습니다."}</p>
              <code title={dataset.id}>{dataset.id}</code>
              <Link className="card-link" href={`/projects/${encodeURIComponent(projectId)}/datasets/${encodeURIComponent(dataset.id)}`}>Dataset 상세 <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      ) : null}
      {totalPages > 0 ? (
        <nav className="pagination" aria-label="Dataset 목록 페이지 이동">
          <button
            className="button button-secondary"
            type="button"
            disabled={page <= 1 || refreshing}
            onClick={() => movePage(page - 1)}
          >
            이전
          </button>
          <span>{`전체 ${total}건 · ${page} / ${totalPages} 페이지`}</span>
          <button
            className="button button-secondary"
            type="button"
            disabled={page >= totalPages || refreshing}
            onClick={() => movePage(page + 1)}
          >
            다음
          </button>
        </nav>
      ) : null}
    </section>
  );
}
