import Link from "next/link";

import {
  type ComparisonStatus,
  type DashboardRecentExperiment,
  type ExperimentHistoryItem,
  type ExperimentStatus,
  type GateStatus,
  type ReadinessStatus,
  type TrendDirection,
} from "@/src/lib/api/analytics";
import {
  formatLocalDateTime,
  formatRate,
  formatRateDelta,
  shortId,
} from "@/src/lib/formatters";

type SemanticStatus =
  | ExperimentStatus
  | GateStatus
  | ComparisonStatus
  | ReadinessStatus
  | TrendDirection
  | "DRAFT"
  | "APPROVED"
  | "DEPRECATED"
  | "UNKNOWN";

const positive = new Set<SemanticStatus>(["COMPLETED", "PASS", "IMPROVED", "READY", "IMPROVING", "APPROVED"]);
const negative = new Set<SemanticStatus>(["FAILED", "BLOCK", "REGRESSED", "NOT_READY", "DECLINING", "DEPRECATED"]);
const pending = new Set<SemanticStatus>(["CREATED", "RUNNING", "DRAFT"]);

export function SemanticBadge({ status }: { status: SemanticStatus | null }) {
  const label = status ?? "데이터 없음";
  const tone = status && positive.has(status)
    ? "positive"
    : status && negative.has(status)
      ? "negative"
      : status && pending.has(status)
        ? "pending"
        : "neutral";
  return <span className={`semantic-badge semantic-${tone}`}>{label}</span>;
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

const WARNING_LABELS: Record<string, string> = {
  PROJECT_INACTIVE: "비활성 Project입니다. 조회만 가능합니다.",
  FAILED_EXPERIMENTS_PRESENT: "실패한 Experiment가 있습니다.",
  RUNNING_EXPERIMENTS_PRESENT: "현재 실행 중인 Experiment가 있습니다.",
  GATE_BLOCK_HISTORY_PRESENT: "배포 차단 이력이 있습니다.",
  REGRESSION_HISTORY_PRESENT: "회귀 판정 이력이 있습니다.",
  PASS_RATE_DECLINING: "Pass Rate가 하락하고 있습니다.",
  PASS_RATE_UNAVAILABLE: "Pass Rate를 계산할 완료 결과가 없습니다.",
  NO_QUALITY_GATE_HISTORY: "Quality Gate 이력이 없습니다.",
  NO_BASELINE_HISTORY: "Baseline Comparison 이력이 없습니다.",
};

export function WarningList({ codes }: { codes: string[] }) {
  if (codes.length === 0) return <p className="muted">경고가 없습니다.</p>;
  return (
    <ul className="warning-list">
      {codes.map((code, index) => (
        <li key={`${code}-${index}`}>
          <span>{WARNING_LABELS[code] ?? "확인되지 않은 경고입니다."}</span>
          <code>{code}</code>
        </li>
      ))}
    </ul>
  );
}

export function ExperimentCard({
  projectId,
  experiment,
}: {
  projectId: string;
  experiment: ExperimentHistoryItem;
}) {
  const item = experiment;
  const reasonCodes = [
    ...(item.qualityGateResult?.reasonCodes ?? []),
    ...(item.baselineComparison?.reasonCodes ?? []),
  ];
  return (
    <article className="history-card">
      <header>
        <div>
          <p className="eyebrow">Experiment</p>
          <code title={item.experimentId}>{shortId(item.experimentId)}</code>
        </div>
        <SemanticBadge status={item.experimentStatus} />
      </header>
      <div className="history-summary">
        <strong>{formatRate(item.passRate)}</strong>
        <span>
          전체 {item.totalCaseCount} · PASS {item.passedCaseCount} · FAIL {item.failedCaseCount}
          {" "}· ERROR {item.errorCaseCount}
        </span>
      </div>
      <dl className="compact-list">
        <div><dt>Dataset Version</dt><dd><code title={item.datasetVersionId}>{shortId(item.datasetVersionId)}</code></dd></div>
        <div><dt>Target Version</dt><dd><code title={item.targetVersionId}>{shortId(item.targetVersionId)}</code></dd></div>
        <div><dt>Evaluator Version</dt><dd><code title={item.evaluatorVersionId}>{shortId(item.evaluatorVersionId)}</code></dd></div>
        <div><dt>생성</dt><dd>{formatLocalDateTime(item.createdAt)}</dd></div>
        <div><dt>완료</dt><dd>{formatLocalDateTime(item.completedAt)}</dd></div>
      </dl>
      <div className="badge-row">
        <span>Gate <SemanticBadge status={item.qualityGateResult?.status ?? null} /></span>
        <span>Comparison <SemanticBadge status={item.baselineComparison?.status ?? null} /></span>
      </div>
      {reasonCodes.length > 0 ? (
        <p className="reason-codes">Reason: {reasonCodes.join(", ")}</p>
      ) : null}
      <Link
        className="card-link"
        href={`/projects/${encodeURIComponent(projectId)}/experiments/${encodeURIComponent(item.experimentId)}`}
      >
        Experiment 상세 <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

export function RecentExperimentCard({
  projectId,
  experiment,
}: {
  projectId: string;
  experiment: DashboardRecentExperiment;
}) {
  const item = experiment;
  return (
    <article className="history-card">
      <header>
        <div><p className="eyebrow">Experiment</p><code title={item.experimentId}>{shortId(item.experimentId)}</code></div>
        <SemanticBadge status={item.experimentStatus} />
      </header>
      <div className="history-summary">
        <strong>{formatRate(item.passRate)}</strong>
        <span>전체 {item.totalCaseCount} · PASS {item.passedCaseCount} · FAIL {item.failedCaseCount} · ERROR {item.errorCaseCount}</span>
      </div>
      <dl className="compact-list">
        <div><dt>생성</dt><dd>{formatLocalDateTime(item.createdAt)}</dd></div>
        <div><dt>완료</dt><dd>{formatLocalDateTime(item.completedAt)}</dd></div>
      </dl>
      <div className="badge-row">
        <span>Gate <SemanticBadge status={item.qualityGateStatus} /></span>
        <span>Comparison <SemanticBadge status={item.baselineComparisonStatus} /></span>
      </div>
      <Link
        className="card-link"
        href={`/projects/${encodeURIComponent(projectId)}/experiments/${encodeURIComponent(item.experimentId)}`}
      >
        Experiment 상세 <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

export function TrendValues({
  first,
  latest,
  delta,
}: {
  first: string | null;
  latest: string | null;
  delta: string | null;
}) {
  return (
    <dl className="trend-values">
      <div><dt>첫 Pass Rate</dt><dd>{formatRate(first)}</dd></div>
      <div><dt>최신 Pass Rate</dt><dd>{formatRate(latest)}</dd></div>
      <div><dt>변화량</dt><dd>{formatRateDelta(delta)}</dd></div>
    </dl>
  );
}
