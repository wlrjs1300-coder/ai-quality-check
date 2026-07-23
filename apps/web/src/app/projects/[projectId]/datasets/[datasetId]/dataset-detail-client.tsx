"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { SemanticBadge } from "@/src/components/AnalyticsUi";
import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import { StatusBadge } from "@/src/components/StatusBadge";
import {
  createDatasetVersion,
  createEvaluationCase,
  getDataset,
  listDatasetVersions,
  listEvaluationCases,
  transitionEvaluationCase,
  updateEvaluationCase,
  type CaseSeverity,
  type Dataset,
  type DatasetVersion,
  type EvaluationCase,
  type EvaluationCaseInput,
} from "@/src/lib/api/datasets";
import { toApiError, type ApiError } from "@/src/lib/api/errors";
import { formatLocalDateTime, shortId } from "@/src/lib/formatters";

type Props = { projectId: string; datasetId: string };
type FormState = {
  caseKey: string; question: string; expectedSummary: string; evidenceSource: string;
  evidenceContent: string; required: string; forbidden: string; tags: string;
  severity: CaseSeverity; requiredForRelease: boolean;
};

const emptyForm = (): FormState => ({
  caseKey: "", question: "", expectedSummary: "", evidenceSource: "", evidenceContent: "",
  required: "", forbidden: "", tags: "", severity: "MEDIUM", requiredForRelease: false,
});
const lines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const objectText = (items: Record<string, unknown>[], key: string) =>
  items.map((item) => typeof item[key] === "string" ? item[key] : "").filter(Boolean).join("\n");

function payload(form: FormState): EvaluationCaseInput {
  const evidence = form.evidenceContent.trim()
    ? [{ source_id: form.evidenceSource.trim() || "frontend-verification", content: form.evidenceContent.trim() }]
    : [];
  return {
    case_key: form.caseKey.trim(),
    question: form.question.trim(),
    expected_summary: form.expectedSummary.trim() || null,
    evidence,
    required_elements: lines(form.required).map((text) => ({ text })),
    forbidden_elements: lines(form.forbidden).map((text) => ({ text })),
    tags: lines(form.tags).map((name) => ({ name })),
    severity: form.severity,
    required_for_release: form.requiredForRelease,
  };
}

function formFromCase(item: EvaluationCase): FormState {
  const firstEvidence = item.evidence[0] ?? {};
  return {
    caseKey: item.caseKey,
    question: item.question,
    expectedSummary: item.expectedSummary ?? "",
    evidenceSource: typeof firstEvidence.source_id === "string" ? firstEvidence.source_id : "",
    evidenceContent: typeof firstEvidence.content === "string" ? firstEvidence.content : "",
    required: objectText(item.requiredElements, "text"),
    forbidden: objectText(item.forbiddenElements, "text"),
    tags: objectText(item.tags, "name"),
    severity: item.severity,
    requiredForRelease: item.requiredForRelease,
  };
}

export function DatasetDetailClient({ projectId, datasetId }: Props) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [cases, setCases] = useState<EvaluationCase[]>([]);
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [casePage, setCasePage] = useState(1);
  const [versionPage, setVersionPage] = useState(1);
  const [caseTotal, setCaseTotal] = useState(0);
  const [versionTotal, setVersionTotal] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [datasetError, setDatasetError] = useState<ApiError | null>(null);
  const [caseError, setCaseError] = useState<ApiError | null>(null);
  const [versionError, setVersionError] = useState<ApiError | null>(null);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const loadDataset = useCallback(async (signal?: AbortSignal) => {
    try { setDatasetError(null); setDataset((await getDataset(datasetId, signal)).data); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setDatasetError(toApiError(error)); }
  }, [datasetId]);
  const loadCases = useCallback(async (page: number, signal?: AbortSignal) => {
    try {
      setCaseError(null);
      const result = await listEvaluationCases(datasetId, page, signal);
      setCases(result.data); setCaseTotal(result.pagination.total);
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setCaseError(toApiError(error)); }
  }, [datasetId]);
  const loadVersions = useCallback(async (page: number, signal?: AbortSignal) => {
    try {
      setVersionError(null);
      const result = await listDatasetVersions(datasetId, page, signal);
      setVersions(result.data); setVersionTotal(result.pagination.total);
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setVersionError(toApiError(error)); }
  }, [datasetId]);

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    void Promise.allSettled([loadDataset(controller.signal), loadCases(casePage, controller.signal), loadVersions(versionPage, controller.signal)])
      .finally(() => { if (controllerRef.current === controller) setLoading(false); });
    return () => controller.abort();
  }, [casePage, loadCases, loadDataset, loadVersions, versionPage]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitCase(event: FormEvent) {
    event.preventDefault();
    if (!form.question.trim() || (!editingId && !form.caseKey.trim()) || submitting) return;
    setSubmitting(true); setFormError(null);
    try {
      const input = payload(form);
      if (editingId) {
        const { case_key: _, ...update } = input;
        await updateEvaluationCase(editingId, update);
      } else {
        await createEvaluationCase(datasetId, input);
      }
      setForm(emptyForm()); setEditingId(null); setCasePage(1); await loadCases(1);
    } catch (error) { setFormError(toApiError(error)); }
    finally { setSubmitting(false); }
  }

  async function transition(item: EvaluationCase, action: "approve" | "deprecate") {
    if (actionId) return;
    if (action === "deprecate" && !window.confirm(`Case ${item.caseKey}를 폐기하시겠습니까?`)) return;
    setActionId(item.id); setCaseError(null);
    try { await transitionEvaluationCase(item.id, action); await loadCases(casePage); }
    catch (error) {
      const apiError = toApiError(error);
      await loadCases(casePage);
      setCaseError(apiError);
    }
    finally { setActionId(null); }
  }

  async function createVersion() {
    if (creatingVersion) return;
    setCreatingVersion(true); setVersionError(null);
    try { await createDatasetVersion(datasetId); setVersionPage(1); await loadVersions(1); }
    catch (error) { setVersionError(toApiError(error)); }
    finally { setCreatingVersion(false); }
  }

  const approvedCount = cases.filter((item) => item.status === "APPROVED").length;
  const approvedKnownAbsent = caseTotal === 0 || (caseTotal <= 20 && approvedCount === 0);
  const inactive = dataset ? !dataset.isActive : true;
  const formErrorMessage = formError?.code === "DUPLICATE_CASE_KEY_IN_DATASET"
    ? "같은 case_key가 이미 있습니다."
    : formError?.code === "RESOURCE_IMMUTABLE" ? "승인 또는 폐기된 Case는 수정할 수 없습니다." : formError?.message;
  const caseErrorMessage = caseError?.code === "INVALID_STATE_TRANSITION"
    ? "현재 Case 상태에서는 이 작업을 수행할 수 없습니다."
    : caseError?.code === "RESOURCE_IMMUTABLE"
      ? "승인 또는 폐기된 Case는 수정할 수 없습니다."
      : caseError?.message;
  const versionErrorMessage = versionError?.code === "DUPLICATE_DATASET_VERSION"
    ? "같은 Snapshot Version이 이미 있습니다."
    : versionError?.code === "NO_APPROVED_CASES"
      ? "승인된 Case가 없어 Version을 생성할 수 없습니다."
      : versionError?.code === "VERSION_NUMBER_CONFLICT"
        ? "Version 번호 충돌이 발생했습니다. 목록을 갱신한 뒤 다시 시도해 주세요."
        : versionError?.code === "DATASET_INACTIVE" || versionError?.code === "PROJECT_INACTIVE"
          ? "비활성 리소스에서는 Version을 생성할 수 없습니다."
          : versionError?.message;

  if (loading && !dataset && !datasetError) return <main className="app-shell"><LoadingState title="Dataset을 불러오고 있습니다" /></main>;
  if (datasetError && !dataset) return <main className="app-shell"><ErrorState message={datasetError.message} retryable={datasetError.retryable} onRetry={() => void loadDataset()} /></main>;

  return (
    <main className="app-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/projects">Projects</Link><span>/</span><Link href={`/projects/${projectId}`}>Overview</Link><span>/</span><span>Dataset</span></nav>
      {dataset ? (
        <>
          <header className="detail-header">
            <div><p className="eyebrow">Dataset</p><h1>{dataset.name}</h1><p className="page-description">{dataset.description || "설명이 없습니다."}</p><code>{dataset.id}</code></div>
            <StatusBadge active={dataset.isActive} />
          </header>
          <p className="notice">생성·수정 시각은 현재 Dataset API가 제공하지 않습니다. 이름·설명 수정과 비활성화 UI는 이번 Slice에서 제외했습니다.</p>

          <section className="overview-section" aria-labelledby="case-title">
            <div className="section-heading"><div><p className="eyebrow">Evaluation</p><h2 id="case-title">Evaluation Cases</h2></div><span>{caseTotal}건</span></div>
            <form className="form-panel case-form" onSubmit={(event) => void submitCase(event)}>
              <h3>{editingId ? "DRAFT Case 수정" : "Case 생성"}</h3>
              <div className="form-grid">
                <label>Case key<input value={form.caseKey} disabled={Boolean(editingId) || inactive || submitting} maxLength={120} onChange={(event) => setField("caseKey", event.target.value)} required /></label>
                <label>Severity<select value={form.severity} disabled={inactive || submitting} onChange={(event) => setField("severity", event.target.value as CaseSeverity)}><option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select></label>
              </div>
              <label>질문<textarea value={form.question} disabled={inactive || submitting} onChange={(event) => setField("question", event.target.value)} required /></label>
              <label>예상 요약<textarea value={form.expectedSummary} disabled={inactive || submitting} onChange={(event) => setField("expectedSummary", event.target.value)} /></label>
              <div className="form-grid">
                <label>Evidence source ID<input value={form.evidenceSource} disabled={inactive || submitting} onChange={(event) => setField("evidenceSource", event.target.value)} /></label>
                <label>Evidence 내용<textarea value={form.evidenceContent} disabled={inactive || submitting} onChange={(event) => setField("evidenceContent", event.target.value)} /></label>
              </div>
              <div className="form-grid">
                <label>필수 요소 <small>한 줄에 하나</small><textarea value={form.required} disabled={inactive || submitting} onChange={(event) => setField("required", event.target.value)} /></label>
                <label>금지 요소 <small>한 줄에 하나</small><textarea value={form.forbidden} disabled={inactive || submitting} onChange={(event) => setField("forbidden", event.target.value)} /></label>
              </div>
              <label>태그 <small>한 줄에 하나</small><textarea value={form.tags} disabled={inactive || submitting} onChange={(event) => setField("tags", event.target.value)} /></label>
              <label className="checkbox-label"><input type="checkbox" checked={form.requiredForRelease} disabled={inactive || submitting} onChange={(event) => setField("requiredForRelease", event.target.checked)} />Release 필수 Case</label>
              {formErrorMessage ? <p className="form-error" role="alert">{formErrorMessage}</p> : null}
              <div className="form-actions">
                {editingId ? <button className="button button-secondary" type="button" disabled={submitting} onClick={() => { setEditingId(null); setForm(emptyForm()); }}>취소</button> : null}
                <button className="button" disabled={inactive || submitting}>{submitting ? "저장 중…" : editingId ? "수정 저장" : "Case 생성"}</button>
              </div>
            </form>
            {caseError ? <ErrorState message={caseErrorMessage ?? "Case 작업을 완료하지 못했습니다."} retryable onRetry={() => void loadCases(casePage)} /> : null}
            {!caseError && cases.length === 0 ? <p className="empty-inline">등록된 Case가 없습니다.</p> : null}
            <div className="case-grid">
              {cases.map((item) => (
                <article className="case-card" key={item.id}>
                  <header><div><p className="eyebrow">{item.caseKey}</p><h3>{item.question}</h3></div><SemanticBadge status={item.status} /></header>
                  <p>{item.expectedSummary || "예상 요약 없음"}</p>
                  <div className="badge-row"><span>Severity <strong>{item.severity}</strong></span><span>{item.requiredForRelease ? "Release 필수" : "일반 Case"}</span></div>
                  <p className="muted">필수 {item.requiredElements.length} · 금지 {item.forbiddenElements.length} · 태그 {item.tags.length}</p>
                  <div className="case-actions">
                    <button className="button button-secondary" disabled={item.status !== "DRAFT" || inactive || Boolean(actionId)} title={item.status !== "DRAFT" ? "DRAFT Case만 수정할 수 있습니다." : undefined} onClick={() => { setEditingId(item.id); setForm(formFromCase(item)); }}>수정</button>
                    <button className="button" disabled={item.status !== "DRAFT" || inactive || Boolean(actionId)} title={item.status !== "DRAFT" ? "DRAFT Case만 승인할 수 있습니다." : undefined} onClick={() => void transition(item, "approve")}>{actionId === item.id ? "처리 중…" : "승인"}</button>
                    <button className="button button-danger" disabled={item.status === "DEPRECATED" || inactive || Boolean(actionId)} title={item.status === "DEPRECATED" ? "폐기된 Case는 추가 전이가 불가능합니다." : undefined} onClick={() => void transition(item, "deprecate")}>폐기</button>
                  </div>
                  {item.status === "APPROVED" ? <p className="immutable-note">승인된 내용은 불변이며 폐기만 가능합니다.</p> : null}
                  {item.status === "DEPRECATED" ? <p className="immutable-note">폐기된 Case는 조회만 가능합니다.</p> : null}
                </article>
              ))}
            </div>
            <Pagination page={casePage} total={caseTotal} onChange={setCasePage} />
          </section>

          <section className="overview-section" aria-labelledby="version-title">
            <div className="section-heading"><div><p className="eyebrow">Snapshot</p><h2 id="version-title">Dataset Versions</h2></div><button className="button" disabled={inactive || approvedKnownAbsent || creatingVersion} onClick={() => void createVersion()}>{creatingVersion ? "생성 중…" : "Version 생성"}</button></div>
            <p className="page-description">현재 APPROVED Case만 불변 Snapshot에 포함됩니다. 현재 페이지에서 확인한 승인 Case는 {approvedCount}건입니다. 최종 검증은 서버가 수행합니다.</p>
            {approvedKnownAbsent ? <p className="notice">승인된 Case가 없어 Version 생성이 비활성화됐습니다.</p> : null}
            {versionError ? <ErrorState message={versionErrorMessage ?? "Version 작업을 완료하지 못했습니다."} retryable onRetry={() => void loadVersions(versionPage)} /> : null}
            {versions.length === 0 && !versionError ? <p className="empty-inline">생성된 Version이 없습니다.</p> : null}
            <div className="version-list">
              {versions.map((version) => (
                <article className="version-card" key={version.id}>
                  <div><p className="eyebrow">Version {version.version}</p><strong>{version.caseCount} Cases</strong></div>
                  <code title={version.contentHash}>{shortId(version.contentHash)}</code>
                  <span>{formatLocalDateTime(version.createdAt)}</span>
                  <Link className="button button-secondary" href={`/projects/${projectId}/datasets/${datasetId}/versions/${version.version}`}>상세</Link>
                </article>
              ))}
            </div>
            <p className="immutable-note">Dataset Version은 생성 후 수정하거나 삭제할 수 없습니다.</p>
            <Pagination page={versionPage} total={versionTotal} onChange={setVersionPage} />
          </section>
        </>
      ) : null}
    </main>
  );
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / 20);
  if (totalPages <= 1) return null;
  return <nav className="pagination" aria-label="Pagination"><button className="button button-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>이전</button><span>{page} / {totalPages}</span><button className="button button-secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>다음</button></nav>;
}
