import { getData, getPaginatedData } from "./client";
import { unexpectedApiError } from "./errors";
import {
  isBoolean,
  isFiniteNumber,
  isNullableString,
  isRecord,
  isString,
  type PaginatedResult,
} from "./types";

export type ExperimentStatus = "CREATED" | "RUNNING" | "COMPLETED" | "FAILED";
export type GateStatus = "PASS" | "BLOCK";
export type ComparisonStatus = "IMPROVED" | "UNCHANGED" | "REGRESSED";
export type ReadinessStatus = "READY" | "NOT_READY" | "UNKNOWN";
export type TrendDirection = "IMPROVING" | "STABLE" | "DECLINING" | "UNKNOWN";
export type HistorySort = "created_at_desc" | "created_at_asc";

export type PeriodFilter = {
  createdFrom: string | null;
  createdTo: string | null;
};

export type ProjectAnalytics = {
  projectId: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Readiness = {
  status: ReadinessStatus;
  reasonCodes: string[];
  reasonSummary: string;
};

export type QualityGateHistory = {
  resultId: string;
  policyId: string;
  status: GateStatus;
  passRate: string;
  reasonCodes: string[];
  createdAt: string;
};

export type BaselineComparisonHistory = {
  comparisonId: string;
  baselineExperimentId: string;
  currentExperimentId: string;
  status: ComparisonStatus;
  passRateDelta: string;
  reasonCodes: string[];
  createdAt: string;
};

export type ExperimentHistoryItem = {
  experimentId: string;
  datasetVersionId: string;
  targetVersionId: string;
  evaluatorVersionId: string;
  experimentStatus: ExperimentStatus;
  totalCaseCount: number;
  passedCaseCount: number;
  failedCaseCount: number;
  errorCaseCount: number;
  passRate: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  qualityGateResult: QualityGateHistory | null;
  baselineComparison: BaselineComparisonHistory | null;
};

export type DashboardRecentExperiment = {
  experimentId: string;
  experimentStatus: ExperimentStatus;
  passRate: string | null;
  totalCaseCount: number;
  passedCaseCount: number;
  failedCaseCount: number;
  errorCaseCount: number;
  createdAt: string;
  completedAt: string | null;
  qualityGateStatus: GateStatus | null;
  baselineComparisonStatus: ComparisonStatus | null;
};

export type DashboardOverview = {
  project: ProjectAnalytics;
  period: PeriodFilter;
  readiness: Readiness;
  kpis: {
    experimentCount: number;
    completedExperimentCount: number;
    failedExperimentCount: number;
    runningExperimentCount: number;
    latestPassRate: string | null;
    averagePassRate: string | null;
    passRateDelta: string | null;
    gatePassCount: number;
    gateBlockCount: number;
    comparisonRegressedCount: number;
  };
  recentExperiments: DashboardRecentExperiment[];
  latestQualityGateResult: QualityGateHistory | null;
  latestBaselineComparison: BaselineComparisonHistory | null;
  trend: {
    direction: TrendDirection;
    firstPassRate: string | null;
    latestPassRate: string | null;
    passRateDelta: string | null;
    summary: string;
  };
  warningCodes: string[];
};

export type SummaryReport = {
  project: ProjectAnalytics;
  period: PeriodFilter;
  readiness: Readiness;
  summary: string;
  metrics: TrendMetrics;
  latestExperiment: ExperimentHistoryItem | null;
  latestQualityGateResult: QualityGateHistory | null;
  latestBaselineComparison: BaselineComparisonHistory | null;
  warningCodes: string[];
};

export type TrendMetrics = {
  experimentCount: number;
  pendingExperimentCount: number;
  runningExperimentCount: number;
  completedExperimentCount: number;
  failedExperimentCount: number;
  averagePassRate: string | null;
  firstPassRate: string | null;
  latestPassRate: string | null;
  passRateDelta: string | null;
  gatePassCount: number;
  gateBlockCount: number;
  gateMissingCount: number;
  comparisonImprovedCount: number;
  comparisonUnchangedCount: number;
  comparisonRegressedCount: number;
  comparisonMissingCount: number;
};

export type TrendSummary = TrendMetrics & {
  projectId: string;
  createdFrom: string | null;
  createdTo: string | null;
  latestExperiment: ExperimentHistoryItem | null;
  latestQualityGateResult: QualityGateHistory | null;
  latestBaselineComparison: BaselineComparisonHistory | null;
};

export type HistoryQuery = PeriodFilter & {
  page: number;
  size: number;
  experimentStatus: ExperimentStatus | null;
  gateStatus: GateStatus | null;
  comparisonStatus: ComparisonStatus | null;
  sort: HistorySort;
};

const EXPERIMENT_STATUSES = ["CREATED", "RUNNING", "COMPLETED", "FAILED"] as const;
const GATE_STATUSES = ["PASS", "BLOCK"] as const;
const COMPARISON_STATUSES = ["IMPROVED", "UNCHANGED", "REGRESSED"] as const;
const READINESS_STATUSES = ["READY", "NOT_READY", "UNKNOWN"] as const;
const TREND_DIRECTIONS = ["IMPROVING", "STABLE", "DECLINING", "UNKNOWN"] as const;

function fail(context: string): never {
  throw unexpectedApiError(`${context} 응답 형식이 올바르지 않습니다.`);
}

function oneOf<T extends string>(value: unknown, values: readonly T[], context: string): T {
  if (!isString(value) || !values.includes(value as T)) fail(context);
  return value as T;
}

function stringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value) || !value.every(isString)) fail(context);
  return [...value];
}

function decimal(value: unknown, context: string): string | null {
  if (value === null) return null;
  if (!isString(value) || value.trim() === "" || !Number.isFinite(Number(value))) fail(context);
  return value;
}

function dateTime(value: unknown, context: string, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (!isString(value) || Number.isNaN(Date.parse(value))) fail(context);
  return value;
}

function numberField(value: unknown, context: string): number {
  if (!isFiniteNumber(value)) fail(context);
  return value;
}

function parsePeriod(value: unknown): PeriodFilter {
  if (!isRecord(value)) fail("기간");
  return {
    createdFrom: dateTime(value.created_from, "기간", true),
    createdTo: dateTime(value.created_to, "기간", true),
  };
}

function parseProjectAnalytics(value: unknown): ProjectAnalytics {
  if (
    !isRecord(value) ||
    !isString(value.project_id) ||
    !isString(value.slug) ||
    !isString(value.name) ||
    !isNullableString(value.description) ||
    !isBoolean(value.is_active)
  ) {
    fail("Project");
  }
  return {
    projectId: value.project_id,
    slug: value.slug,
    name: value.name,
    description: value.description,
    isActive: value.is_active,
    createdAt: dateTime(value.created_at, "Project") as string,
    updatedAt: dateTime(value.updated_at, "Project") as string,
  };
}

function parseReadiness(value: unknown): Readiness {
  if (!isRecord(value) || !isString(value.reason_summary)) fail("Readiness");
  return {
    status: oneOf(value.status, READINESS_STATUSES, "Readiness"),
    reasonCodes: stringArray(value.reason_codes, "Readiness"),
    reasonSummary: value.reason_summary,
  };
}

function parseQualityGate(value: unknown): QualityGateHistory | null {
  if (value === null) return null;
  if (!isRecord(value) || !isString(value.result_id) || !isString(value.policy_id)) {
    fail("Quality Gate");
  }
  return {
    resultId: value.result_id,
    policyId: value.policy_id,
    status: oneOf(value.status, GATE_STATUSES, "Quality Gate"),
    passRate: decimal(value.pass_rate, "Quality Gate") as string,
    reasonCodes: stringArray(value.reason_codes, "Quality Gate"),
    createdAt: dateTime(value.created_at, "Quality Gate") as string,
  };
}

function parseComparison(value: unknown): BaselineComparisonHistory | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !isString(value.comparison_id) ||
    !isString(value.baseline_experiment_id) ||
    !isString(value.current_experiment_id)
  ) {
    fail("Baseline Comparison");
  }
  return {
    comparisonId: value.comparison_id,
    baselineExperimentId: value.baseline_experiment_id,
    currentExperimentId: value.current_experiment_id,
    status: oneOf(value.status, COMPARISON_STATUSES, "Baseline Comparison"),
    passRateDelta: decimal(value.pass_rate_delta, "Baseline Comparison") as string,
    reasonCodes: stringArray(value.reason_codes, "Baseline Comparison"),
    createdAt: dateTime(value.created_at, "Baseline Comparison") as string,
  };
}

export function parseExperimentHistoryItem(value: unknown): ExperimentHistoryItem {
  if (
    !isRecord(value) ||
    !isString(value.experiment_id) ||
    !isString(value.dataset_version_id) ||
    !isString(value.target_version_id) ||
    !isString(value.evaluator_version_id)
  ) {
    fail("Experiment History");
  }
  return {
    experimentId: value.experiment_id,
    datasetVersionId: value.dataset_version_id,
    targetVersionId: value.target_version_id,
    evaluatorVersionId: value.evaluator_version_id,
    experimentStatus: oneOf(value.experiment_status, EXPERIMENT_STATUSES, "Experiment History"),
    totalCaseCount: numberField(value.total_case_count, "Experiment History"),
    passedCaseCount: numberField(value.passed_case_count, "Experiment History"),
    failedCaseCount: numberField(value.failed_case_count, "Experiment History"),
    errorCaseCount: numberField(value.error_case_count, "Experiment History"),
    passRate: decimal(value.pass_rate, "Experiment History"),
    createdAt: dateTime(value.created_at, "Experiment History") as string,
    startedAt: dateTime(value.started_at, "Experiment History", true),
    completedAt: dateTime(value.completed_at, "Experiment History", true),
    qualityGateResult: parseQualityGate(value.quality_gate_result),
    baselineComparison: parseComparison(value.baseline_comparison),
  };
}

function parseDashboardRecentExperiment(value: unknown): DashboardRecentExperiment {
  if (!isRecord(value) || !isString(value.experiment_id)) fail("Dashboard Recent Experiment");
  return {
    experimentId: value.experiment_id,
    experimentStatus: oneOf(value.experiment_status, EXPERIMENT_STATUSES, "Dashboard Recent Experiment"),
    passRate: decimal(value.pass_rate, "Dashboard Recent Experiment"),
    totalCaseCount: numberField(value.total_case_count, "Dashboard Recent Experiment"),
    passedCaseCount: numberField(value.passed_case_count, "Dashboard Recent Experiment"),
    failedCaseCount: numberField(value.failed_case_count, "Dashboard Recent Experiment"),
    errorCaseCount: numberField(value.error_case_count, "Dashboard Recent Experiment"),
    createdAt: dateTime(value.created_at, "Dashboard Recent Experiment") as string,
    completedAt: dateTime(value.completed_at, "Dashboard Recent Experiment", true),
    qualityGateStatus: value.quality_gate_status === null
      ? null
      : oneOf(value.quality_gate_status, GATE_STATUSES, "Dashboard Recent Experiment"),
    baselineComparisonStatus: value.baseline_comparison_status === null
      ? null
      : oneOf(value.baseline_comparison_status, COMPARISON_STATUSES, "Dashboard Recent Experiment"),
  };
}

function parseTrendMetrics(value: Record<string, unknown>): TrendMetrics {
  return {
    experimentCount: numberField(value.experiment_count, "Trend"),
    pendingExperimentCount: numberField(value.pending_experiment_count, "Trend"),
    runningExperimentCount: numberField(value.running_experiment_count, "Trend"),
    completedExperimentCount: numberField(value.completed_experiment_count, "Trend"),
    failedExperimentCount: numberField(value.failed_experiment_count, "Trend"),
    averagePassRate: decimal(value.average_pass_rate, "Trend"),
    firstPassRate: decimal(value.first_pass_rate, "Trend"),
    latestPassRate: decimal(value.latest_pass_rate, "Trend"),
    passRateDelta: decimal(value.pass_rate_delta, "Trend"),
    gatePassCount: numberField(value.gate_pass_count, "Trend"),
    gateBlockCount: numberField(value.gate_block_count, "Trend"),
    gateMissingCount: numberField(value.gate_missing_count, "Trend"),
    comparisonImprovedCount: numberField(value.comparison_improved_count, "Trend"),
    comparisonUnchangedCount: numberField(value.comparison_unchanged_count, "Trend"),
    comparisonRegressedCount: numberField(value.comparison_regressed_count, "Trend"),
    comparisonMissingCount: numberField(value.comparison_missing_count, "Trend"),
  };
}

export function parseDashboard(value: unknown): DashboardOverview {
  if (!isRecord(value) || !isRecord(value.kpis) || !isRecord(value.trend)) fail("Dashboard");
  const recent = value.recent_experiments;
  if (!Array.isArray(recent) || !isString(value.trend.summary)) fail("Dashboard");
  return {
    project: parseProjectAnalytics(value.project),
    period: parsePeriod(value.period),
    readiness: parseReadiness(value.readiness),
    kpis: {
      experimentCount: numberField(value.kpis.experiment_count, "Dashboard"),
      completedExperimentCount: numberField(value.kpis.completed_experiment_count, "Dashboard"),
      failedExperimentCount: numberField(value.kpis.failed_experiment_count, "Dashboard"),
      runningExperimentCount: numberField(value.kpis.running_experiment_count, "Dashboard"),
      latestPassRate: decimal(value.kpis.latest_pass_rate, "Dashboard"),
      averagePassRate: decimal(value.kpis.average_pass_rate, "Dashboard"),
      passRateDelta: decimal(value.kpis.pass_rate_delta, "Dashboard"),
      gatePassCount: numberField(value.kpis.gate_pass_count, "Dashboard"),
      gateBlockCount: numberField(value.kpis.gate_block_count, "Dashboard"),
      comparisonRegressedCount: numberField(value.kpis.comparison_regressed_count, "Dashboard"),
    },
    recentExperiments: recent.map(parseDashboardRecentExperiment),
    latestQualityGateResult: parseQualityGate(value.latest_quality_gate_result),
    latestBaselineComparison: parseComparison(value.latest_baseline_comparison),
    trend: {
      direction: oneOf(value.trend.direction, TREND_DIRECTIONS, "Dashboard Trend"),
      firstPassRate: decimal(value.trend.first_pass_rate, "Dashboard Trend"),
      latestPassRate: decimal(value.trend.latest_pass_rate, "Dashboard Trend"),
      passRateDelta: decimal(value.trend.pass_rate_delta, "Dashboard Trend"),
      summary: value.trend.summary,
    },
    warningCodes: stringArray(value.warning_codes, "Dashboard"),
  };
}

export function parseSummary(value: unknown): SummaryReport {
  if (!isRecord(value) || !isRecord(value.metrics) || !isString(value.summary)) fail("Summary");
  return {
    project: parseProjectAnalytics(value.project),
    period: parsePeriod(value.period),
    readiness: parseReadiness(value.readiness),
    summary: value.summary,
    metrics: parseTrendMetrics(value.metrics),
    latestExperiment: value.latest_experiment === null
      ? null
      : parseExperimentHistoryItem(value.latest_experiment),
    latestQualityGateResult: parseQualityGate(value.latest_quality_gate_result),
    latestBaselineComparison: parseComparison(value.latest_baseline_comparison),
    warningCodes: stringArray(value.warning_codes, "Summary"),
  };
}

export function parseTrend(value: unknown): TrendSummary {
  if (!isRecord(value) || !isString(value.project_id)) fail("Trend");
  return {
    projectId: value.project_id,
    createdFrom: dateTime(value.created_from, "Trend", true),
    createdTo: dateTime(value.created_to, "Trend", true),
    ...parseTrendMetrics(value),
    latestExperiment: value.latest_experiment === null
      ? null
      : parseExperimentHistoryItem(value.latest_experiment),
    latestQualityGateResult: parseQualityGate(value.latest_quality_gate_result),
    latestBaselineComparison: parseComparison(value.latest_baseline_comparison),
  };
}

export function analyticsPeriodQuery(period: PeriodFilter): string {
  const params = new URLSearchParams();
  if (period.createdFrom) params.set("created_from", period.createdFrom);
  if (period.createdTo) params.set("created_to", period.createdTo);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function historyQuery(query: HistoryQuery, includePagination = true): string {
  const params = new URLSearchParams();
  if (includePagination) {
    params.set("page", String(query.page));
    params.set("size", String(query.size));
  }
  if (query.experimentStatus) params.set("experiment_status", query.experimentStatus);
  if (query.gateStatus) params.set("gate_status", query.gateStatus);
  if (query.comparisonStatus) params.set("comparison_status", query.comparisonStatus);
  if (query.createdFrom) params.set("created_from", query.createdFrom);
  if (query.createdTo) params.set("created_to", query.createdTo);
  params.set("sort", query.sort);
  return `?${params.toString()}`;
}

export function getDashboard(projectId: string, period: PeriodFilter, signal?: AbortSignal) {
  return getData(
    `/projects/${encodeURIComponent(projectId)}/dashboard-overview${analyticsPeriodQuery(period)}`,
    parseDashboard,
    signal,
  );
}

export function getSummary(projectId: string, period: PeriodFilter, signal?: AbortSignal) {
  return getData(
    `/projects/${encodeURIComponent(projectId)}/summary-report${analyticsPeriodQuery(period)}`,
    parseSummary,
    signal,
  );
}

export function getTrend(projectId: string, period: PeriodFilter, signal?: AbortSignal) {
  return getData(
    `/projects/${encodeURIComponent(projectId)}/trend-summary${analyticsPeriodQuery(period)}`,
    parseTrend,
    signal,
  );
}

export function getHistory(
  projectId: string,
  query: HistoryQuery,
  signal?: AbortSignal,
): Promise<PaginatedResult<ExperimentHistoryItem>> {
  return getPaginatedData(
    `/projects/${encodeURIComponent(projectId)}/experiment-history${historyQuery(query)}`,
    parseExperimentHistoryItem,
    signal,
  );
}
