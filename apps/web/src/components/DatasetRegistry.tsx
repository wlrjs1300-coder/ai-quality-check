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
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async (refresh = false) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await listDatasets(projectId, 1, controller.signal);
      setDatasets(result.data);
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(toApiError(loadError));
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [projectId]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
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
      await load(true);
    } catch (submitError) {
      setFormError(toApiError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="overview-section" aria-labelledby="dataset-registry-title">
      <div className="section-heading">
        <div><p className="eyebrow">Registry</p><h2 id="dataset-registry-title">Datasets</h2></div>
        {refreshing ? <span className="count-label" aria-live="polite">갱신 중…</span> : <span className="count-label">{datasets.length}건</span>}
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
      {loading ? <LoadingState title="Dataset 목록을 불러오고 있습니다" /> : null}
      {error ? <ErrorState message={error.message} retryable={error.retryable} onRetry={() => void load()} /> : null}
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
    </section>
  );
}
