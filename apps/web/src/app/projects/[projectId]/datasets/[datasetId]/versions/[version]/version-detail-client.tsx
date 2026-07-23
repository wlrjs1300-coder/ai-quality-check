"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { SemanticBadge } from "@/src/components/AnalyticsUi";
import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import { getDataset, getDatasetVersion, type Dataset, type DatasetVersionDetail } from "@/src/lib/api/datasets";
import { toApiError, type ApiError } from "@/src/lib/api/errors";
import { formatLocalDateTime } from "@/src/lib/formatters";

type Props = { projectId: string; datasetId: string; versionValue: string };

function labels(items: Record<string, unknown>[], key: string): string[] {
  return items.map((item) => typeof item[key] === "string" ? item[key] : "").filter(Boolean);
}

export function DatasetVersionDetailClient({ projectId, datasetId, versionValue }: Props) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [version, setVersion] = useState<DatasetVersionDetail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const controllerRef = useRef<AbortController | null>(null);
  const versionNumber = Number(versionValue);

  const load = useCallback(async () => {
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      setError(toApiError(new Error("Invalid version"))); setLoading(false); return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null); setLoading(true);
    const results = await Promise.allSettled([
      getDataset(datasetId, controller.signal),
      getDatasetVersion(datasetId, versionNumber, controller.signal),
    ]);
    if (controllerRef.current !== controller) return;
    if (results[0].status === "fulfilled") setDataset(results[0].value.data);
    else if (!(results[0].reason instanceof DOMException && results[0].reason.name === "AbortError")) setError(toApiError(results[0].reason));
    if (results[1].status === "fulfilled") setVersion(results[1].value.data);
    else if (!(results[1].reason instanceof DOMException && results[1].reason.name === "AbortError")) setError(toApiError(results[1].reason));
    setLoading(false);
  }, [datasetId, versionNumber]);

  useEffect(() => { void load(); return () => controllerRef.current?.abort(); }, [load]);

  if (loading) return <main className="app-shell"><LoadingState title="Dataset Version을 불러오고 있습니다" /></main>;
  if (error || !dataset || !version) return <main className="app-shell"><ErrorState message={error?.code === "DATASET_VERSION_NOT_FOUND" ? "Dataset Version을 찾을 수 없습니다." : error?.message ?? "응답 데이터가 없습니다."} retryable={Boolean(error?.retryable)} onRetry={() => void load()} /></main>;

  return (
    <main className="app-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/projects">Projects</Link><span>/</span><Link href={`/projects/${projectId}`}>Overview</Link><span>/</span><Link href={`/projects/${projectId}/datasets/${datasetId}`}>{dataset.name}</Link><span>/</span><span>Version {version.version}</span></nav>
      <header className="detail-header"><div><p className="eyebrow">Immutable Snapshot</p><h1>Dataset Version {version.version}</h1><p className="page-description">생성 당시 승인된 Case 내용을 보존합니다. 원본 Case가 변경되거나 폐기돼도 이 Snapshot에는 영향을 주지 않습니다.</p></div><SemanticBadge status="APPROVED" /></header>
      <section className="detail-panel"><dl className="detail-list"><div><dt>Dataset</dt><dd>{dataset.name}</dd></div><div><dt>Version ID</dt><dd><code>{version.id}</code></dd></div><div><dt>Content Hash</dt><dd><code>{version.contentHash}</code></dd></div><div><dt>Case Count</dt><dd>{version.caseCount}</dd></div><div><dt>생성</dt><dd>{formatLocalDateTime(version.createdAt)}</dd></div></dl></section>
      <section className="overview-section" aria-labelledby="snapshot-case-title"><div className="section-heading"><h2 id="snapshot-case-title">Snapshot Cases</h2><span>{version.cases.length}건</span></div>
        {version.cases.length === 0 ? <p className="empty-inline">Snapshot Case가 없습니다.</p> : null}
        <div className="case-grid">{version.cases.map((item) => {
          const required = labels(item.requiredElements, "text");
          const forbidden = labels(item.forbiddenElements, "text");
          const tags = labels(item.tags, "name");
          return <article className="case-card" key={item.id}><header><div><p className="eyebrow">{item.caseKey}</p><h3>{item.question}</h3></div><strong>{item.severity}</strong></header><p>{item.expectedSummary || "예상 요약 없음"}</p><dl className="compact-list"><div><dt>Source Case</dt><dd><code>{item.sourceEvaluationCaseId}</code></dd></div><div><dt>Release 필수</dt><dd>{item.requiredForRelease ? "예" : "아니요"}</dd></div><div><dt>필수 요소</dt><dd>{required.join(", ") || "없음"}</dd></div><div><dt>금지 요소</dt><dd>{forbidden.join(", ") || "없음"}</dd></div><div><dt>태그</dt><dd>{tags.join(", ") || "없음"}</dd></div></dl></article>;
        })}</div>
      </section>
    </main>
  );
}
