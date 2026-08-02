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
import { EvaluatorRegistry } from "@/src/components/EvaluatorRegistry";
import { TargetRegistry } from "@/src/components/TargetRegistry";
import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import { Breadcrumb } from "@/src/components/Breadcrumb";
import { PageHeader } from "@/src/components/PageHeader";
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
  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: "Projects", href: "/projects" },
        { label: "Project Overview" },
      ]}
    />
  );
  if (loading && !project && !projectError) {
    return (
      <main className="app-shell">
        {breadcrumb}
        <PageHeader title="Project Overview" />
        <LoadingState title="Project Overview를 불러오고 있습니다" />
      </main>
    );
  }

  return (
    <main className="app-shell">
      {breadcrumb}

      {projectError ? (
        <>
          <PageHeader title="Project Overview" />
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
          <PageHeader
            eyebrow={project.slug}
            title={project.name}
            description={project.description || "설명이 없습니다."}
            actions={(
              <>
                <Link className="button" href={`/projects/${encodeURIComponent(projectId)}/experiments/new`}>Experiment 생성</Link>
                <Link className="button button-secondary" href={`/projects/${encodeURIComponent(projectId)}/history`}>전체 History</Link>
                <Link className="button button-secondary" href="/projects">Projects로 돌아가기</Link>
              </>
            )}
            status={<StatusBadge active={project.isActive} />}
          />

          <div className="project-overview-filter">
            <p className="project-overview-filter-note">선택한 기간은 Release Decision과 Dashboard 전체에 적용됩니다.</p>
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
          </div>
          {refreshing ? <p className="refreshing" aria-live="polite">기존 데이터를 유지하며 기간 결과를 갱신하고 있습니다.</p> : null}

          <section className="overview-section" aria-labelledby="release-decision-title">
            <div className="section-heading">
              <div><p className="eyebrow">Release</p><h2 id="release-decision-title">Release Decision</h2></div>
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
            {summaryError ? (
              <ErrorState title="Summary를 불러오지 못했습니다" message={summaryError.message} retryable={summaryError.retryable} onRetry={() => void load(period, true)} />
            ) : null}
            {!summary && !summaryError ? <LoadingState title="Summary를 불러오고 있습니다" /> : null}
            {dashboard || summary ? (
              <div className="release-decision-panel">
                <div className="release-decision-grid">
                  <div className="release-decision-summary">
                    <div className="release-decision-status">
                      <h3>배포 준비 상태</h3>
                      <SemanticBadge status={(dashboard ?? summary)?.readiness.status ?? null} />
                    </div>
                    {summary ? <p className="summary-copy">{summary.summary}</p> : null}
                    <p>{(dashboard ?? summary)?.readiness.reasonSummary}</p>
                  </div>
                  <div className="release-decision-latest">
                    <h3>최신 품질 판정</h3>
                    <p><span>Quality Gate</span><SemanticBadge status={dashboard?.latestQualityGateResult?.status ?? summary?.latestQualityGateResult?.status ?? null} /></p>
                    <p><span>Comparison</span><SemanticBadge status={dashboard?.latestBaselineComparison?.status ?? summary?.latestBaselineComparison?.status ?? null} /></p>
                    {(dashboard?.latestBaselineComparison ?? summary?.latestBaselineComparison) ? (
                      <Link
                        className="card-link"
                        href={`/projects/${encodeURIComponent(projectId)}/comparisons/${encodeURIComponent((dashboard?.latestBaselineComparison ?? summary?.latestBaselineComparison)!.comparisonId)}`}
                      >
                        최신 Comparison 상세 <span aria-hidden="true">→</span>
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="release-decision-warnings"><h3>Warning</h3><WarningList codes={(dashboard ?? summary)?.warningCodes ?? []} /></div>
              </div>
            ) : null}
          </section>

          {dashboard ? (
            <section className="overview-section" aria-labelledby="kpi-title">
              <div className="section-heading"><div><p className="eyebrow">Dashboard</p><h2 id="kpi-title">핵심 KPI</h2></div></div>
              <div className="project-overview-kpi-grid">
                <MetricCard label="전체 Experiment" value={dashboard.kpis.experimentCount} />
                <MetricCard label="최신 Pass Rate" value={formatRate(dashboard.kpis.latestPassRate)} />
                <MetricCard label="Gate PASS / BLOCK" value={`${dashboard.kpis.gatePassCount} / ${dashboard.kpis.gateBlockCount}`} />
                <MetricCard label="Regression" value={dashboard.kpis.comparisonRegressedCount} />
              </div>

              <section className="recent-experiments" aria-labelledby="recent-title">
                <div className="section-heading"><h2 id="recent-title">최근 Experiment</h2><span className="count-label">최대 5건</span></div>
                {dashboard.recentExperiments.length === 0 ? (
                  <p className="empty-inline">선택한 기간에 해당하는 Experiment가 없습니다.</p>
                ) : (
                  <div className="history-grid">
                    {dashboard.recentExperiments.slice(0, 5).map((item) => (
                      <RecentExperimentCard key={item.experimentId} projectId={projectId} experiment={item} />
                    ))}
                  </div>
                )}
              </section>
            </section>
          ) : null}

          <section className="overview-section" aria-labelledby="detail-analysis-title">
            <div className="section-heading"><div><p className="eyebrow">Analytics</p><h2 id="detail-analysis-title">상세 분석</h2></div></div>
            {dashboard ? (
              <div className="overview-grid">
                <article className="detail-panel">
                  <h3>실행 상태</h3>
                  <div className="analysis-metric-grid">
                    <MetricCard label="완료" value={dashboard.kpis.completedExperimentCount} />
                    <MetricCard label="실패" value={dashboard.kpis.failedExperimentCount} />
                    <MetricCard label="실행 중" value={dashboard.kpis.runningExperimentCount} />
                  </div>
                </article>
                <article className="detail-panel">
                  <h3>품질 추세 <SemanticBadge status={dashboard.trend.direction} /></h3>
                  <p>{dashboard.trend.summary}</p>
                  <div className="analysis-metric-grid analysis-metric-grid-two">
                    <MetricCard label="평균 Pass Rate" value={formatRate(dashboard.kpis.averagePassRate)} />
                    <MetricCard label="Pass Rate Delta" value={formatRateDelta(dashboard.kpis.passRateDelta)} />
                  </div>
                  <TrendValues first={dashboard.trend.firstPassRate} latest={dashboard.trend.latestPassRate} delta={dashboard.trend.passRateDelta} />
                </article>
              </div>
            ) : null}
            {trendError ? (
              <ErrorState title="Trend를 불러오지 못했습니다" message={trendError.message} retryable={trendError.retryable} onRetry={() => void load(period, true)} />
            ) : null}
            {trend ? (
              <article className="detail-panel comparison-analysis">
                <h3>Comparison</h3>
                <div className="analysis-metric-grid">
                  <MetricCard label="개선" value={trend.comparisonImprovedCount} />
                  <MetricCard label="유지" value={trend.comparisonUnchangedCount} />
                  <MetricCard label="회귀" value={trend.comparisonRegressedCount} />
                </div>
                {!dashboard ? <TrendValues first={trend.firstPassRate} latest={trend.latestPassRate} delta={trend.passRateDelta} /> : null}
              </article>
            ) : !trendError ? <LoadingState title="Trend를 불러오고 있습니다" /> : null}
          </section>

          <section className="overview-section registry-introduction" aria-labelledby="evaluation-configuration-title">
            <div className="section-heading"><div><p className="eyebrow">Registry</p><h2 id="evaluation-configuration-title">평가 구성</h2></div></div>
            <p>Dataset, Target, Evaluator의 버전과 실행 구성을 관리합니다.</p>
          </section>
          <DatasetRegistry projectId={projectId} projectActive={project.isActive} />
          <TargetRegistry projectId={projectId} projectActive={project.isActive} />
          <EvaluatorRegistry projectId={projectId} projectActive={project.isActive} />
        </>
      ) : null}
    </main>
  );
}
