"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { SemanticBadge } from "@/src/components/AnalyticsUi";
import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import {
  getBaselineComparison,
  listBaselineComparisonCases,
  type BaselineComparison,
  type BaselineComparisonCase,
  type ComparisonCaseStatus,
} from "@/src/lib/api/comparisons";
import { ApiError, toApiError, type ApiErrorKind } from "@/src/lib/api/errors";
import { formatLocalDateTime, formatRateDelta } from "@/src/lib/formatters";

const CASE_SIZE = 20;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function localError(code: string, message: string, kind: ApiErrorKind): ApiError {
  return new ApiError({
    kind,
    status: kind === "application" ? 404 : null,
    code,
    message,
  });
}

function CaseStatusBadge({ status }: { status: ComparisonCaseStatus }) {
  const tone = status === "PASS"
    ? "positive"
    : status === "FAIL"
      ? "pending"
      : "negative";
  return <span className={`semantic-badge semantic-${tone}`}>{status}</span>;
}

export function ComparisonDetailClient({
  projectId,
  comparisonId,
}: {
  projectId: string;
  comparisonId: string;
}) {
  const [comparison, setComparison] = useState<BaselineComparison | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [scopeVerified, setScopeVerified] = useState(false);
  const [detailError, setDetailError] = useState<ApiError | null>(null);
  const [cases, setCases] = useState<BaselineComparisonCase[]>([]);
  const [casePage, setCasePage] = useState(1);
  const [caseTotal, setCaseTotal] = useState(0);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseRefreshing, setCaseRefreshing] = useState(false);
  const [caseError, setCaseError] = useState<ApiError | null>(null);

  const detailControllerRef = useRef<AbortController | null>(null);
  const detailRequestIdRef = useRef(0);
  const caseControllerRef = useRef<AbortController | null>(null);
  const caseRequestIdRef = useRef(0);

  const loadCases = useCallback(async (page = 1, retainData = false) => {
    const requestId = ++caseRequestIdRef.current;
    caseControllerRef.current?.abort();
    const controller = new AbortController();
    caseControllerRef.current = controller;
    const requestPage = Math.max(1, page);
    setCaseError(null);
    if (retainData) setCaseRefreshing(true);
    else setCaseLoading(true);

    try {
      const response = await listBaselineComparisonCases(
        comparisonId,
        requestPage,
        CASE_SIZE,
        controller.signal,
      );
      if (
        requestId !== caseRequestIdRef.current
        || caseControllerRef.current !== controller
      ) {
        return;
      }
      if (response.data.some((item) => item.comparisonId !== comparisonId)) {
        setCaseError(localError(
          "BASELINE_COMPARISON_CASE_SCOPE_MISMATCH",
          "Comparison Case 범위가 일치하지 않습니다.",
          "unexpected",
        ));
        return;
      }
      setCases(response.data);
      setCasePage(response.pagination.page);
      setCaseTotal(response.pagination.total);
    } catch (error) {
      if (caseControllerRef.current !== controller || isAbortError(error)) return;
      setCaseError(toApiError(error));
    } finally {
      if (
        requestId === caseRequestIdRef.current
        && caseControllerRef.current === controller
      ) {
        setCaseLoading(false);
        setCaseRefreshing(false);
        caseControllerRef.current = null;
      }
    }
  }, [comparisonId]);

  const loadDetail = useCallback(async () => {
    const requestId = ++detailRequestIdRef.current;
    detailControllerRef.current?.abort();
    caseControllerRef.current?.abort();
    const controller = new AbortController();
    detailControllerRef.current = controller;
    setDetailLoading(true);
    setDetailError(null);
    setScopeVerified(false);

    try {
      const response = await getBaselineComparison(comparisonId, controller.signal);
      if (
        requestId !== detailRequestIdRef.current
        || detailControllerRef.current !== controller
      ) {
        return;
      }
      if (response.data.projectId !== projectId) {
        setComparison(null);
        setDetailError(localError(
          "BASELINE_COMPARISON_NOT_FOUND",
          "Comparison을 찾을 수 없습니다.",
          "application",
        ));
        return;
      }
      setComparison(response.data);
      setScopeVerified(true);
      void loadCases(1, false);
    } catch (error) {
      if (detailControllerRef.current !== controller || isAbortError(error)) return;
      setComparison(null);
      setDetailError(toApiError(error));
    } finally {
      if (
        requestId === detailRequestIdRef.current
        && detailControllerRef.current === controller
      ) {
        setDetailLoading(false);
        detailControllerRef.current = null;
      }
    }
  }, [comparisonId, loadCases, projectId]);

  useEffect(() => {
    void loadDetail();
    return () => {
      detailControllerRef.current?.abort();
      caseControllerRef.current?.abort();
    };
  }, [loadDetail]);

  const notFound = detailError?.status === 404
    || detailError?.code === "BASELINE_COMPARISON_NOT_FOUND";
  const totalPages = caseTotal === 0 ? 0 : Math.ceil(caseTotal / CASE_SIZE);

  if (detailLoading && !comparison && !detailError) {
    return (
      <main className="app-shell">
        <LoadingState title="Comparison 상세를 불러오고 있습니다" />
      </main>
    );
  }

  if (detailError && !comparison) {
    return (
      <main className="app-shell">
        <ErrorState
          title={detailError.kind === "network" ? "서버에 연결할 수 없습니다" : undefined}
          message={notFound ? "Comparison을 찾을 수 없습니다." : detailError.message}
          retryable={!notFound && detailError.retryable}
          onRetry={() => void loadDetail()}
        />
        <div className="header-actions">
          <Link className="button button-secondary" href={`/projects/${encodeURIComponent(projectId)}/history`}>
            History로 돌아가기
          </Link>
          <Link className="button button-secondary" href={`/projects/${encodeURIComponent(projectId)}`}>
            Project Overview로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {comparison && scopeVerified ? (
        <>
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href={`/projects/${encodeURIComponent(projectId)}`}>Project Overview</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/projects/${encodeURIComponent(projectId)}/history`}>History</Link>
            <span aria-hidden="true">/</span>
            <span>Comparison</span>
          </nav>

          <header className="detail-header">
            <div>
              <p className="eyebrow">Baseline Comparison</p>
              <h1>Comparison 상세</h1>
              <code>{comparison.id}</code>
              <div className="header-actions">
                <Link className="button button-secondary" href={`/projects/${encodeURIComponent(projectId)}/history`}>
                  History로 돌아가기
                </Link>
                <Link className="button button-secondary" href={`/projects/${encodeURIComponent(projectId)}`}>
                  Project Overview로 돌아가기
                </Link>
              </div>
            </div>
            <SemanticBadge status={comparison.status} />
          </header>

          <section className="detail-panel">
            <dl className="detail-list">
              <div><dt>Status</dt><dd><SemanticBadge status={comparison.status} /></dd></div>
              <div><dt>전체 Case</dt><dd>{comparison.totalCaseCount}</dd></div>
              <div><dt>IMPROVED</dt><dd>{comparison.improvedCaseCount}</dd></div>
              <div><dt>UNCHANGED</dt><dd>{comparison.unchangedCaseCount}</dd></div>
              <div><dt>REGRESSED</dt><dd>{comparison.regressedCaseCount}</dd></div>
              <div><dt>Baseline PASS</dt><dd>{comparison.baselinePassedCaseCount}</dd></div>
              <div><dt>Current PASS</dt><dd>{comparison.currentPassedCaseCount}</dd></div>
              <div><dt>Pass Rate Delta</dt><dd>{formatRateDelta(comparison.passRateDelta)}</dd></div>
              <div>
                <dt>Reason Codes</dt>
                <dd className="comparison-reasons">
                  {comparison.reasonCodes.length > 0
                    ? comparison.reasonCodes.map((code) => (
                      <span className="semantic-badge semantic-neutral" key={code}>{code}</span>
                    ))
                    : "없음"}
                </dd>
              </div>
              <div><dt>Reason Summary</dt><dd>{comparison.reasonSummary ?? "없음"}</dd></div>
              <div><dt>생성</dt><dd>{formatLocalDateTime(comparison.createdAt)}</dd></div>
            </dl>
          </section>

          <section className="overview-section" aria-labelledby="comparison-experiments-title">
            <div className="section-heading">
              <h2 id="comparison-experiments-title">비교 Experiment</h2>
            </div>
            <div className="overview-grid">
              <article className="detail-panel">
                <p className="eyebrow">Baseline</p>
                <code>{comparison.baselineExperimentId}</code>
                <Link
                  className="card-link"
                  href={`/projects/${encodeURIComponent(projectId)}/experiments/${encodeURIComponent(comparison.baselineExperimentId)}`}
                >
                  Baseline Experiment 상세 <span aria-hidden="true">→</span>
                </Link>
              </article>
              <article className="detail-panel">
                <p className="eyebrow">Current</p>
                <code>{comparison.currentExperimentId}</code>
                <Link
                  className="card-link"
                  href={`/projects/${encodeURIComponent(projectId)}/experiments/${encodeURIComponent(comparison.currentExperimentId)}`}
                >
                  Current Experiment 상세 <span aria-hidden="true">→</span>
                </Link>
              </article>
            </div>
          </section>

          <section className="overview-section" aria-labelledby="case-diff-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Case Diff</p>
                <h2 id="case-diff-title">Case별 변화</h2>
              </div>
              <span className="count-label">{caseRefreshing ? "갱신 중…" : `전체 ${caseTotal}건`}</span>
            </div>

            {caseLoading && cases.length === 0 ? (
              <LoadingState title="Case Diff를 불러오고 있습니다" />
            ) : null}
            {caseError ? (
              <ErrorState
                title={caseError.kind === "network" ? "서버에 연결할 수 없습니다" : "Case Diff 조회 실패"}
                message={caseError.message}
                retryable
                onRetry={() => void loadCases(casePage, cases.length > 0)}
              />
            ) : null}
            {!caseLoading && !caseError && cases.length === 0 ? (
              <p className="empty-inline">저장된 Case Diff가 없습니다.</p>
            ) : null}

            <div className="comparison-case-list">
              {cases.map((item) => (
                <article className="result-card" key={item.id}>
                  <header>
                    <div>
                      <p className="eyebrow">Case</p>
                      <strong>{item.caseKey}</strong>
                    </div>
                    <SemanticBadge status={item.changeStatus} />
                  </header>
                  <dl className="compact-list">
                    <div><dt>Baseline</dt><dd><CaseStatusBadge status={item.baselineStatus} /></dd></div>
                    <div><dt>Current</dt><dd><CaseStatusBadge status={item.currentStatus} /></dd></div>
                    <div><dt>Change</dt><dd><SemanticBadge status={item.changeStatus} /></dd></div>
                    <div><dt>Reason Code</dt><dd>{item.reasonCode}</dd></div>
                    <div><dt>생성</dt><dd>{formatLocalDateTime(item.createdAt)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>

            {caseTotal > 0 ? (
              <nav className="pagination" aria-label="Comparison Case 페이지 이동">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={casePage <= 1 || caseRefreshing}
                  onClick={() => void loadCases(casePage - 1, true)}
                >
                  이전
                </button>
                <span>전체 {caseTotal}건 · {casePage} / {totalPages} 페이지</span>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={casePage >= totalPages || caseRefreshing}
                  onClick={() => void loadCases(casePage + 1, true)}
                >
                  다음
                </button>
              </nav>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
