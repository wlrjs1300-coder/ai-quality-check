"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ExperimentCard } from "@/src/components/AnalyticsUi";
import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import {
  getHistory,
  historyQuery,
  type ComparisonStatus,
  type ExperimentHistoryItem,
  type ExperimentStatus,
  type GateStatus,
  type HistoryQuery,
  type HistorySort,
} from "@/src/lib/api/analytics";
import { downloadCsv } from "@/src/lib/api/client";
import { toApiError, type ApiError } from "@/src/lib/api/errors";
import type { Pagination } from "@/src/lib/api/types";

type InitialValues = {
  from: string;
  to: string;
  experimentStatus: string;
  gateStatus: string;
  comparisonStatus: string;
  sort: string;
  page: string;
};

type ProjectHistoryClientProps = {
  projectId: string;
  initial: InitialValues;
};

const EXPERIMENT_STATUSES = ["CREATED", "RUNNING", "COMPLETED", "FAILED"] as const;
const GATE_STATUSES = ["PASS", "BLOCK"] as const;
const COMPARISON_STATUSES = ["IMPROVED", "UNCHANGED", "REGRESSED"] as const;

function member<T extends string>(value: string, options: readonly T[]): T | null {
  return options.includes(value as T) ? value as T : null;
}

function localBoundary(value: string, end: boolean): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function initialQuery(initial: InitialValues): HistoryQuery {
  const page = Number(initial.page);
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    size: 20,
    experimentStatus: member(initial.experimentStatus, EXPERIMENT_STATUSES),
    gateStatus: member(initial.gateStatus, GATE_STATUSES),
    comparisonStatus: member(initial.comparisonStatus, COMPARISON_STATUSES),
    createdFrom: localBoundary(initial.from, false),
    createdTo: localBoundary(initial.to, true),
    sort: initial.sort === "created_at_asc" ? "created_at_asc" : "created_at_desc",
  };
}

export function ProjectHistoryClient({ projectId, initial }: ProjectHistoryClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState<HistoryQuery>(() => initialQuery(initial));
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [experimentStatus, setExperimentStatus] = useState<ExperimentStatus | "">(member(initial.experimentStatus, EXPERIMENT_STATUSES) ?? "");
  const [gateStatus, setGateStatus] = useState<GateStatus | "">(member(initial.gateStatus, GATE_STATUSES) ?? "");
  const [comparisonStatus, setComparisonStatus] = useState<ComparisonStatus | "">(member(initial.comparisonStatus, COMPARISON_STATUSES) ?? "");
  const [sort, setSort] = useState<HistorySort>(initial.sort === "created_at_asc" ? "created_at_asc" : "created_at_desc");
  const [items, setItems] = useState<ExperimentHistoryItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, size: 20 });
  const [error, setError] = useState<ApiError | null>(null);
  const [downloadError, setDownloadError] = useState<ApiError | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const hasItemsRef = useRef(false);

  const syncUrl = useCallback((next: HistoryQuery, nextFrom: string, nextTo: string) => {
    const params = new URLSearchParams();
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    if (next.experimentStatus) params.set("experiment_status", next.experimentStatus);
    if (next.gateStatus) params.set("gate_status", next.gateStatus);
    if (next.comparisonStatus) params.set("comparison_status", next.comparisonStatus);
    if (next.sort !== "created_at_desc") params.set("sort", next.sort);
    if (next.page !== 1) params.set("page", String(next.page));
    router.replace(`/projects/${encodeURIComponent(projectId)}/history${params.size ? `?${params}` : ""}`);
  }, [projectId, router]);

  const load = useCallback(async (next: HistoryQuery) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    controllerRef.current = controller;
    setError(null);
    if (hasItemsRef.current) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await getHistory(projectId, next, controller.signal);
      if (requestId !== requestIdRef.current) return;
      setItems(result.data);
      hasItemsRef.current = result.data.length > 0;
      setPagination(result.pagination);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      if (requestId === requestIdRef.current) setError(toApiError(loadError));
    } finally {
      if (requestId === requestIdRef.current) {
        controllerRef.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [projectId]);

  useEffect(() => {
    void load(query);
    return () => controllerRef.current?.abort();
  }, [load, query]);

  function applyFilters() {
    if (from && to && from > to) {
      setFilterError("시작일은 종료일보다 늦을 수 없습니다.");
      return;
    }
    setFilterError(null);
    const next: HistoryQuery = {
      page: 1,
      size: 20,
      experimentStatus: experimentStatus || null,
      gateStatus: gateStatus || null,
      comparisonStatus: comparisonStatus || null,
      createdFrom: localBoundary(from, false),
      createdTo: localBoundary(to, true),
      sort,
    };
    syncUrl(next, from, to);
    setQuery(next);
  }

  function resetFilters() {
    setFrom("");
    setTo("");
    setExperimentStatus("");
    setGateStatus("");
    setComparisonStatus("");
    setSort("created_at_desc");
    setFilterError(null);
    const next: HistoryQuery = {
      page: 1,
      size: 20,
      experimentStatus: null,
      gateStatus: null,
      comparisonStatus: null,
      createdFrom: null,
      createdTo: null,
      sort: "created_at_desc",
    };
    syncUrl(next, "", "");
    setQuery(next);
  }

  function movePage(page: number) {
    const next = { ...query, page };
    syncUrl(next, from, to);
    setQuery(next);
  }

  async function exportCsv() {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(null);
    let objectUrl: string | null = null;
    try {
      const result = await downloadCsv(
        `/projects/${encodeURIComponent(projectId)}/experiment-history.csv${historyQuery(query, false)}`,
        `project-${projectId}-experiment-history.csv`,
      );
      objectUrl = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = result.filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (exportError) {
      if (!(exportError instanceof DOMException && exportError.name === "AbortError")) {
        setDownloadError(toApiError(exportError));
      }
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setDownloading(false);
    }
  }

  const totalPages = useMemo(
    () => pagination.total === 0 ? 0 : Math.ceil(pagination.total / pagination.size),
    [pagination],
  );

  return (
    <main className="app-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/projects">Projects</Link><span aria-hidden="true">/</span>
        <Link href={`/projects/${encodeURIComponent(projectId)}`}>Overview</Link><span aria-hidden="true">/</span><span>History</span>
      </nav>
      <header className="page-header">
        <div><p className="eyebrow">Experiment</p><h1>History</h1><p className="page-description">기간과 판정 상태별 실행 이력을 조회하고 같은 조건으로 CSV를 내보냅니다.</p></div>
        <button className="button" type="button" disabled={downloading || loading} onClick={() => void exportCsv()}>
          {downloading ? "다운로드 중…" : "CSV 다운로드"}
        </button>
      </header>

      <fieldset className="filter-panel">
        <legend>History 필터</legend>
        <div className="history-filter-grid">
          <label>시작일<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>종료일<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label>Experiment 상태<select value={experimentStatus} onChange={(event) => setExperimentStatus(event.target.value as ExperimentStatus | "")}><option value="">전체</option>{EXPERIMENT_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Gate 상태<select value={gateStatus} onChange={(event) => setGateStatus(event.target.value as GateStatus | "")}><option value="">전체</option>{GATE_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Comparison 상태<select value={comparisonStatus} onChange={(event) => setComparisonStatus(event.target.value as ComparisonStatus | "")}><option value="">전체</option>{COMPARISON_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>정렬<select value={sort} onChange={(event) => setSort(event.target.value as HistorySort)}><option value="created_at_desc">최신순</option><option value="created_at_asc">오래된순</option></select></label>
        </div>
        <div className="filter-actions">
          <button className="button" type="button" disabled={refreshing} onClick={applyFilters}>적용</button>
          <button className="button button-secondary" type="button" disabled={refreshing} onClick={resetFilters}>초기화</button>
        </div>
        <p className="field-error" role={filterError ? "alert" : undefined}>{filterError ?? ""}</p>
      </fieldset>

      {refreshing ? <p className="refreshing" aria-live="polite">기존 목록을 유지하며 새 조건을 조회하고 있습니다.</p> : null}
      {downloadError ? <div className="download-error" role="alert"><strong>CSV 다운로드 실패</strong><p>{downloadError.message}</p></div> : null}
      {loading && items.length === 0 ? <LoadingState title="History를 불러오고 있습니다" /> : null}
      {error && items.length === 0 ? (
        error.status === 404 || error.code === "PROJECT_NOT_FOUND" ? (
          <>
            <ErrorState message="Project를 찾을 수 없습니다." />
            <Link className="button button-secondary back-action" href="/projects">
              Projects로 돌아가기
            </Link>
          </>
        ) : (
          <ErrorState
            title={error.kind === "network" ? "서버에 연결할 수 없습니다" : undefined}
            message={error.code === "INVALID_HISTORY_DATE_RANGE"
              ? "시작일은 종료일보다 늦을 수 없습니다. 기간을 수정해 주세요."
              : error.message}
            retryable={error.code !== "INVALID_HISTORY_DATE_RANGE" && error.retryable}
            onRetry={() => void load(query)}
          />
        )
      ) : null}
      {error && items.length > 0 ? (
        <div className="download-error" role="alert">
          <strong>목록을 갱신하지 못했습니다.</strong>
          <p>{error.code === "INVALID_HISTORY_DATE_RANGE"
            ? "시작일은 종료일보다 늦을 수 없습니다. 기간을 수정해 주세요."
            : error.message}</p>
          {error.code !== "INVALID_HISTORY_DATE_RANGE" ? (
            <button className="text-button" type="button" onClick={() => void load(query)}>다시 시도</button>
          ) : null}
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? <section className="state-panel"><div><h2>조건에 맞는 History가 없습니다</h2><p>필터를 초기화하거나 다른 기간을 선택해 주세요.</p></div></section> : null}
      {items.length > 0 ? (
        <div className="history-grid">
          {items.map((item) => (
            <ExperimentCard
              key={item.experimentId}
              projectId={projectId}
              experiment={item}
            />
          ))}
        </div>
      ) : null}

      {items.length > 0 ? (
        <nav className="pagination" aria-label="History pagination">
          <button className="button button-secondary" type="button" disabled={query.page <= 1 || refreshing} onClick={() => movePage(query.page - 1)}>이전</button>
          <span>전체 {pagination.total}건 · {pagination.page} / {totalPages || 0} 페이지</span>
          <button className="button button-secondary" type="button" disabled={totalPages === 0 || query.page >= totalPages || refreshing} onClick={() => movePage(query.page + 1)}>다음</button>
        </nav>
      ) : null}
    </main>
  );
}
