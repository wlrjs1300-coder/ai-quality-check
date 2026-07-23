"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  MetricCard,
  RecentExperimentCard,
  SemanticBadge,
  TrendValues,
  WarningList,
} from "@/src/components/AnalyticsUi";
import { DateRangeFilter } from "@/src/components/DateRangeFilter";
import { DatasetRegistry } from "@/src/components/DatasetRegistry";
import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import { StatusBadge } from "@/src/components/StatusBadge";
import {
  getDashboard,
  getSummary,
  getTrend,
  type DashboardOverview,
  type PeriodFilter,
  type SummaryReport,
  type TrendSummary,
} from "@/src/lib/api/analytics";
import { toApiError, type ApiError } from "@/src/lib/api/errors";
import { getProject, type Project } from "@/src/lib/api/projects";
import { formatRate, formatRateDelta } from "@/src/lib/formatters";

type ProjectDetailClientProps = {
  projectId: string;
  initialFrom: string;
  initialTo: string;
};

function localBoundary(value: string, end: boolean): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function periodFromDates(from: string, to: string): PeriodFilter {
  return { createdFrom: localBoundary(from, false), createdTo: localBoundary(to, true) };
}

export function ProjectDetailClient({
  projectId,
  initialFrom,
  initialTo,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [dashboard, setDashboard] = useState<DashboardOverview | null>(null);
  const [summary, setSummary] = useState<SummaryReport | null>(null);
  const [trend, setTrend] = useState<TrendSummary | null>(null);
  const [projectError, setProjectError] = useState<ApiError | null>(null);
  const [dashboardError, setDashboardError] = useState<ApiError | null>(null);
  const [summaryError, setSummaryError] = useState<ApiError | null>(null);
  const [trendError, setTrendError] = useState<ApiError | null>(null);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [period, setPeriod] = useState(() => periodFromDates(initialFrom, initialTo));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false);

  const load = useCallback(async (nextPeriod: PeriodFilter, retainData = hasDataRef.current) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setProjectError(null);
    setDashboardError(null);
    setSummaryError(null);
    setTrendError(null);
    if (retainData) setRefreshing(true);
    else setLoading(true);

    const results = await Promise.allSettled([
      getProject(projectId, controller.signal),
      getDashboard(projectId, nextPeriod, controller.signal),
      getSummary(projectId, nextPeriod, controller.signal),
      getTrend(projectId, nextPeriod, controller.signal),
    ]);
    if (controllerRef.current !== controller) return;

    const [projectResult, dashboardResult, summaryResult, trendResult] = results;
    if (projectResult.status === "fulfilled") setProject(projectResult.value.data);
    else if (!(projectResult.reason instanceof DOMException && projectResult.reason.name === "AbortError")) setProjectError(toApiError(projectResult.reason));
    if (dashboardResult.status === "fulfilled") setDashboard(dashboardResult.value.data);
    else if (!(dashboardResult.reason instanceof DOMException && dashboardResult.reason.name === "AbortError")) setDashboardError(toApiError(dashboardResult.reason));
    if (summaryResult.status === "fulfilled") setSummary(summaryResult.value.data);
    else if (!(summaryResult.reason instanceof DOMException && summaryResult.reason.name === "AbortError")) setSummaryError(toApiError(summaryResult.reason));
    if (trendResult.status === "fulfilled") setTrend(trendResult.value.data);
    else if (!(trendResult.reason instanceof DOMException && trendResult.reason.name === "AbortError")) setTrendError(toApiError(trendResult.reason));
    hasDataRef.current = results.some((result) => result.status === "fulfilled");
    controllerRef.current = null;
    setLoading(false);
    setRefreshing(false);
  }, [projectId]);

  useEffect(() => {
    void load(period);
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [load, period]);

  function applyFilter() {
    if (from && to && from > to) {
      setFilterError("시작일은 종료일보다 늦을 수 없습니다.");
      return;
    }
    setFilterError(null);
    const next = periodFromDates(from, to);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.replace(`/projects/${encodeURIComponent(projectId)}${params.size ? `?${params}` : ""}`);
    setPeriod(next);
  }

  function resetFilter() {
    setFrom("");
    setTo("");
    setFilterError(null);
    router.replace(`/projects/${encodeURIComponent(projectId)}`);
    const next = periodFromDates("", "");
    setPeriod(next);
  }

  const notFound = projectError?.status === 404 || projectError?.code === "PROJECT_NOT_FOUND";
  if (loading && !project && !projectError) {
    return <main className="app-shell"><LoadingState title="Project Overview를 불러오고 있습니다" /></main>;
  }

  return (
    <main className="app-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/projects">Projects</Link><span aria-hidden="true">/</span><span>Overview</span>
      </nav>

      {projectError ? (
        <>
          <ErrorState
            title={projectError.kind === "network" ? "서버에 연결할 수 없습니다" : undefined}
            message={notFound ? "Project를 찾을 수 없습니다." : projectError.message}
            retryable={!notFound && projectError.retryable}
            onRetry={() => void load(period, false)}
          />
          <Link className="button button-secondary back-action" href="/projects">Projects로 돌아가기</Link>
        </>
      ) : null}

      {project ? (
        <>
          <header className="detail-header">
            <div>
              <p className="eyebrow">{project.slug}</p>
              <h1>{project.name}</h1>
              <p className="page-description">{project.description || "설명이 없습니다."}</p>
              <div className="header-actions">
                <Link className="button button-secondary" href="/projects">Projects</Link>
                <Link className="button" href={`/projects/${encodeURIComponent(projectId)}/history`}>전체 History</Link>
              </div>
            </div>
            <StatusBadge active={project.isActive} />
          </header>

          <DateRangeFilter
            from={from}
            to={to}
            error={filterError}
            disabled={refreshing}
            onFromChange={setFrom}
            onToChange={setTo}
            onApply={applyFilter}
            onReset={resetFilter}
          />
          {refreshing ? <p className="refreshing" aria-live="polite">기존 데이터를 유지하며 기간 결과를 갱신하고 있습니다.</p> : null}

          <section className="overview-section" aria-labelledby="dashboard-title">
            <div className="section-heading">
              <div><p className="eyebrow">Dashboard</p><h2 id="dashboard-title">Release Overview</h2></div>
              {dashboard ? <SemanticBadge status={dashboard.readiness.status} /> : null}
            </div>
            {dashboardError ? (
              <ErrorState
                title="Dashboard를 불러오지 못했습니다"
                message={dashboardError.message}
                retryable={dashboardError.retryable}
                onRetry={() => void load(period, true)}
              />
            ) : null}
            {!dashboard && !dashboardError ? <LoadingState title="Dashboard를 불러오고 있습니다" /> : null}
            {dashboard ? (
              <>
                <div className="metric-grid">
                  <MetricCard label="Experiment" value={dashboard.kpis.experimentCount} />
                  <MetricCard label="완료" value={dashboard.kpis.completedExperimentCount} />
                  <MetricCard label="실패" value={dashboard.kpis.failedExperimentCount} />
                  <MetricCard label="실행 중" value={dashboard.kpis.runningExperimentCount} />
                  <MetricCard label="최신 Pass Rate" value={formatRate(dashboard.kpis.latestPassRate)} />
                  <MetricCard label="평균 Pass Rate" value={formatRate(dashboard.kpis.averagePassRate)} />
                  <MetricCard label="Pass Rate Delta" value={formatRateDelta(dashboard.kpis.passRateDelta)} />
                  <MetricCard label="Gate PASS / BLOCK" value={`${dashboard.kpis.gatePassCount} / ${dashboard.kpis.gateBlockCount}`} />
                  <MetricCard label="Regression" value={dashboard.kpis.comparisonRegressedCount} />
                </div>
                <div className="overview-grid">
                  <article className="detail-panel">
                    <h3>Trend <SemanticBadge status={dashboard.trend.direction} /></h3>
                    <p>{dashboard.trend.summary}</p>
                    <TrendValues first={dashboard.trend.firstPassRate} latest={dashboard.trend.latestPassRate} delta={dashboard.trend.passRateDelta} />
                  </article>
                  <article className="detail-panel">
                    <h3>최신 판정</h3>
                    <p>Quality Gate <SemanticBadge status={dashboard.latestQualityGateResult?.status ?? null} /></p>
                    <p>Comparison <SemanticBadge status={dashboard.latestBaselineComparison?.status ?? null} /></p>
                  </article>
                </div>
                <div className="detail-panel"><h3>Warning</h3><WarningList codes={dashboard.warningCodes} /></div>
                <section aria-labelledby="recent-title">
                  <div className="section-heading"><h3 id="recent-title">최근 Experiment</h3><span className="count-label">최대 5건</span></div>
                  {dashboard.recentExperiments.length === 0 ? (
                    <p className="empty-inline">기간에 해당하는 Experiment가 없습니다.</p>
                  ) : (
                    <div className="history-grid">{dashboard.recentExperiments.slice(0, 5).map((item) => <RecentExperimentCard key={item.experimentId} item={item} />)}</div>
                  )}
                </section>
              </>
            ) : null}
          </section>

          <section className="overview-section" aria-labelledby="summary-title">
            <div className="section-heading"><div><p className="eyebrow">Summary</p><h2 id="summary-title">판정 요약</h2></div></div>
            {summaryError ? (
              <ErrorState title="Summary를 불러오지 못했습니다" message={summaryError.message} retryable={summaryError.retryable} onRetry={() => void load(period, true)} />
            ) : null}
            {!summary && !summaryError ? <LoadingState title="Summary를 불러오고 있습니다" /> : null}
            {summary ? (
              <div className="summary-panel">
                <div>
                  <SemanticBadge status={summary.readiness.status} />
                  <p className="summary-copy">{summary.summary}</p>
                  <p>{summary.readiness.reasonSummary}</p>
                </div>
                <TrendValues first={summary.metrics.firstPassRate} latest={summary.metrics.latestPassRate} delta={summary.metrics.passRateDelta} />
                <WarningList codes={summary.warningCodes} />
              </div>
            ) : null}
          </section>

          <section className="overview-section" aria-labelledby="trend-title">
            <div className="section-heading"><div><p className="eyebrow">Trend</p><h2 id="trend-title">기간 추세</h2></div></div>
            {trendError ? (
              <ErrorState title="Trend를 불러오지 못했습니다" message={trendError.message} retryable={trendError.retryable} onRetry={() => void load(period, true)} />
            ) : null}
            {trend ? (
              <div className="metric-grid">
                <MetricCard label="전체 Experiment" value={trend.experimentCount} />
                <MetricCard label="평균 Pass Rate" value={formatRate(trend.averagePassRate)} />
                <MetricCard label="Pass Rate Delta" value={formatRateDelta(trend.passRateDelta)} />
                <MetricCard label="Comparison 개선 / 유지 / 회귀" value={`${trend.comparisonImprovedCount} / ${trend.comparisonUnchangedCount} / ${trend.comparisonRegressedCount}`} />
              </div>
            ) : !trendError ? <LoadingState title="Trend를 불러오고 있습니다" /> : null}
          </section>
          <DatasetRegistry projectId={projectId} projectActive={project.isActive} />
        </>
      ) : null}
    </main>
  );
}
