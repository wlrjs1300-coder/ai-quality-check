"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import {
  listDatasets,
  listDatasetVersions,
  type Dataset,
  type DatasetVersion,
} from "@/src/lib/api/datasets";
import { toApiError, type ApiError } from "@/src/lib/api/errors";
import {
  getEvaluator,
  getEvaluatorVersionById,
} from "@/src/lib/api/evaluators";
import {
  getExperiment,
  listExperimentResults,
  runExperiment,
  type EvaluationResult,
  type Experiment,
  type ExperimentStatus,
  type JsonValue,
} from "@/src/lib/api/experiments";
import {
  getTarget,
  getTargetVersionById,
} from "@/src/lib/api/targets";
import { formatLocalDateTime, shortId } from "@/src/lib/formatters";

import { BaselineComparisonPanel } from "./baseline-comparison-panel";
import { QualityGatePanel } from "./quality-gate-panel";

const RESULT_SIZE = 20;

type VersionMetadata = {
  dataset: string | null;
  target: string | null;
  evaluator: string | null;
};

type MetadataErrors = {
  target: ApiError | null;
  evaluator: ApiError | null;
};

type DatasetMetadata = {
  dataset: Dataset;
  version: DatasetVersion;
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function jsonText(value: JsonValue): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function ResultBadge({ status }: { status: EvaluationResult["status"] }) {
  const tone = status === "PASS"
    ? "positive"
    : status === "FAIL"
      ? "pending"
      : "negative";
  return <span className={`semantic-badge semantic-${tone}`}>{status}</span>;
}

function ExperimentBadge({ status }: { status: ExperimentStatus }) {
  const tone = status === "COMPLETED"
    ? "positive"
    : status === "FAILED"
      ? "negative"
      : "pending";
  return <span className={`semantic-badge semantic-${tone}`}>{status}</span>;
}

async function findDatasetVersion(
  projectId: string,
  versionId: string,
  signal: AbortSignal,
): Promise<DatasetMetadata | null> {
  let datasetPage = 1;
  while (true) {
    const datasets = await listDatasets(projectId, datasetPage, signal);
    for (const dataset of datasets.data) {
      let versionPage = 1;
      while (true) {
        const versions = await listDatasetVersions(dataset.id, versionPage, signal);
        const version = versions.data.find((item) => item.id === versionId);
        if (version) return { dataset, version };
        const versionPages = versions.pagination.total === 0
          ? 0
          : Math.ceil(versions.pagination.total / Math.max(1, versions.pagination.size));
        if (versionPage >= versionPages) break;
        versionPage += 1;
      }
    }
    const datasetPages = datasets.pagination.total === 0
      ? 0
      : Math.ceil(datasets.pagination.total / Math.max(1, datasets.pagination.size));
    if (datasetPage >= datasetPages) break;
    datasetPage += 1;
  }
  return null;
}

export function ExperimentDetailClient({
  projectId,
  experimentId,
}: {
  projectId: string;
  experimentId: string;
}) {
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [experimentError, setExperimentError] = useState<ApiError | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<ApiError | null>(null);
  const [metadata, setMetadata] = useState<VersionMetadata>({
    dataset: null,
    target: null,
    evaluator: null,
  });
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataErrors, setMetadataErrors] = useState<MetadataErrors>({
    target: null,
    evaluator: null,
  });
  const [scopeChecking, setScopeChecking] = useState(false);
  const [scopeVerified, setScopeVerified] = useState(false);
  const [scopeNotFound, setScopeNotFound] = useState(false);
  const [scopeError, setScopeError] = useState<ApiError | null>(null);
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [resultPage, setResultPage] = useState(1);
  const [resultTotal, setResultTotal] = useState(0);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultRefreshing, setResultRefreshing] = useState(false);
  const [resultError, setResultError] = useState<ApiError | null>(null);

  const experimentControllerRef = useRef<AbortController | null>(null);
  const experimentRequestIdRef = useRef(0);
  const scopeControllerRef = useRef<AbortController | null>(null);
  const scopeRequestIdRef = useRef(0);
  const metadataControllerRef = useRef<AbortController | null>(null);
  const metadataRequestIdRef = useRef(0);
  const resultControllerRef = useRef<AbortController | null>(null);
  const resultRequestIdRef = useRef(0);
  const runControllerRef = useRef<AbortController | null>(null);
  const runRequestIdRef = useRef(0);

  const loadResults = useCallback(async (page = 1, retainData = false) => {
    const requestId = ++resultRequestIdRef.current;
    resultControllerRef.current?.abort();
    const controller = new AbortController();
    resultControllerRef.current = controller;
    const requestPage = Math.max(1, page);

    setResultError(null);
    if (retainData) setResultRefreshing(true);
    else setResultLoading(true);

    try {
      const response = await listExperimentResults(
        experimentId,
        requestPage,
        RESULT_SIZE,
        controller.signal,
      );
      if (requestId !== resultRequestIdRef.current || resultControllerRef.current !== controller) {
        return;
      }
      setResults(response.data);
      setResultPage(response.pagination.page);
      setResultTotal(response.pagination.total);
    } catch (error) {
      if (resultControllerRef.current !== controller || isAbortError(error)) return;
      setResultError(toApiError(error));
    } finally {
      if (requestId === resultRequestIdRef.current && resultControllerRef.current === controller) {
        setResultLoading(false);
        setResultRefreshing(false);
        resultControllerRef.current = null;
      }
    }
  }, [experimentId]);

  const resolveMetadata = useCallback(async (current: Experiment) => {
    const requestId = ++metadataRequestIdRef.current;
    metadataControllerRef.current?.abort();
    const controller = new AbortController();
    metadataControllerRef.current = controller;
    setMetadataLoading(true);
    setMetadataErrors({ target: null, evaluator: null });

    try {
      const [targetResult, evaluatorResult] = await Promise.allSettled([
        (async () => {
          const version = await getTargetVersionById(current.targetVersionId, controller.signal);
          const target = await getTarget(version.data.targetId, controller.signal);
          return `${target.data.name} · Version ${version.data.version} · ${version.data.responseStrategy}`;
        })(),
        (async () => {
          const version = await getEvaluatorVersionById(current.evaluatorVersionId, controller.signal);
          const evaluator = await getEvaluator(version.data.evaluatorId, controller.signal);
          return `${evaluator.data.name} · Version ${version.data.version} · ${version.data.evaluatorTypeSnapshot}`;
        })(),
      ]);
      if (requestId !== metadataRequestIdRef.current || metadataControllerRef.current !== controller) {
        return;
      }

      setMetadata((currentMetadata) => ({
        ...currentMetadata,
        target: targetResult.status === "fulfilled" ? targetResult.value : null,
        evaluator: evaluatorResult.status === "fulfilled" ? evaluatorResult.value : null,
      }));
      setMetadataErrors({
        target: targetResult.status === "rejected" && !isAbortError(targetResult.reason)
          ? toApiError(targetResult.reason)
          : null,
        evaluator: evaluatorResult.status === "rejected" && !isAbortError(evaluatorResult.reason)
          ? toApiError(evaluatorResult.reason)
          : null,
      });
    } finally {
      if (requestId === metadataRequestIdRef.current && metadataControllerRef.current === controller) {
        setMetadataLoading(false);
        metadataControllerRef.current = null;
      }
    }
  }, []);

  const verifyScope = useCallback(async (current: Experiment) => {
    const requestId = ++scopeRequestIdRef.current;
    scopeControllerRef.current?.abort();
    const controller = new AbortController();
    scopeControllerRef.current = controller;
    setScopeChecking(true);
    setScopeError(null);
    setScopeNotFound(false);

    try {
      const datasetMetadata = await findDatasetVersion(
        projectId,
        current.datasetVersionId,
        controller.signal,
      );
      if (requestId !== scopeRequestIdRef.current || scopeControllerRef.current !== controller) {
        return;
      }
      if (datasetMetadata === null) {
        setScopeVerified(false);
        setScopeNotFound(true);
        return;
      }

      setMetadata((currentMetadata) => ({
        ...currentMetadata,
        dataset: `${datasetMetadata.dataset.name} · Version ${datasetMetadata.version.version} · ${datasetMetadata.version.caseCount} cases`,
      }));
      setScopeVerified(true);
      void resolveMetadata(current);
      if (current.status === "COMPLETED" || current.status === "FAILED") {
        void loadResults(1, false);
      }
    } catch (error) {
      if (scopeControllerRef.current !== controller || isAbortError(error)) return;
      const apiError = toApiError(error);
      if (apiError.status === 404 || apiError.code === "PROJECT_NOT_FOUND") {
        setScopeVerified(false);
        setScopeNotFound(true);
      } else {
        setScopeError(apiError);
      }
    } finally {
      if (requestId === scopeRequestIdRef.current && scopeControllerRef.current === controller) {
        setScopeChecking(false);
        scopeControllerRef.current = null;
      }
    }
  }, [loadResults, projectId, resolveMetadata]);

  const loadExperiment = useCallback(async (
    retainData = false,
    includeResults = true,
  ): Promise<Experiment | null> => {
    const requestId = ++experimentRequestIdRef.current;
    experimentControllerRef.current?.abort();
    const controller = new AbortController();
    experimentControllerRef.current = controller;

    setExperimentError(null);
    if (retainData) setRefreshing(true);
    else setInitialLoading(true);

    try {
      const response = await getExperiment(experimentId, controller.signal);
      if (requestId !== experimentRequestIdRef.current || experimentControllerRef.current !== controller) {
        return null;
      }
      setExperiment(response.data);
      if (includeResults) void verifyScope(response.data);
      return response.data;
    } catch (error) {
      if (experimentControllerRef.current !== controller || isAbortError(error)) return null;
      setExperimentError(toApiError(error));
      return null;
    } finally {
      if (requestId === experimentRequestIdRef.current && experimentControllerRef.current === controller) {
        setInitialLoading(false);
        setRefreshing(false);
        experimentControllerRef.current = null;
      }
    }
  }, [experimentId, verifyScope]);

  useEffect(() => {
    void loadExperiment(false, true);
    return () => {
      experimentControllerRef.current?.abort();
      scopeControllerRef.current?.abort();
      metadataControllerRef.current?.abort();
      resultControllerRef.current?.abort();
      runControllerRef.current?.abort();
    };
  }, [loadExperiment]);

  async function execute() {
    if (!experiment || experiment.status !== "CREATED" || running) return;

    const requestId = ++runRequestIdRef.current;
    runControllerRef.current?.abort();
    const controller = new AbortController();
    runControllerRef.current = controller;
    setRunning(true);
    setRunError(null);

    try {
      const response = await runExperiment(experimentId, controller.signal);
      if (requestId !== runRequestIdRef.current || runControllerRef.current !== controller) {
        return;
      }
      setExperiment(response.data);
      await loadExperiment(true, false);
      await loadResults(1, false);
    } catch (error) {
      if (runControllerRef.current !== controller || isAbortError(error)) return;
      const originalError = toApiError(error);
      const recovered = await loadExperiment(true, false);
      if (recovered?.status === "COMPLETED" || recovered?.status === "FAILED") {
        await loadResults(1, false);
      }
      if (recovered === null) {
        setRunError(originalError);
      } else if (recovered.status === "CREATED") {
        setRunError(originalError);
      } else if (recovered.status === "RUNNING") {
        setRunError(null);
      }
    } finally {
      if (requestId === runRequestIdRef.current && runControllerRef.current === controller) {
        setRunning(false);
        runControllerRef.current = null;
      }
    }
  }

  const experimentNotFound = experimentError?.status === 404
    || experimentError?.code === "EXPERIMENT_NOT_FOUND";

  if (initialLoading && !experiment && !experimentError) {
    return <main className="app-shell"><LoadingState title="Experiment를 불러오고 있습니다" /></main>;
  }

  if (experimentError && !experiment) {
    return (
      <main className="app-shell">
        <ErrorState
          title={experimentError.kind === "network" ? "서버에 연결할 수 없습니다" : undefined}
          message={experimentNotFound ? "Experiment를 찾을 수 없습니다." : experimentError.message}
          retryable={!experimentNotFound && experimentError.retryable}
          onRetry={() => void loadExperiment(false, true)}
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

  if (experiment && scopeChecking && !scopeVerified) {
    return <main className="app-shell"><LoadingState title="Experiment의 Project 범위를 확인하고 있습니다" /></main>;
  }

  if (experiment && scopeNotFound) {
    return (
      <main className="app-shell">
        <ErrorState message="Experiment를 찾을 수 없습니다." />
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

  if (experiment && scopeError && !scopeVerified) {
    return (
      <main className="app-shell">
        <ErrorState
          title={scopeError.kind === "network" ? "서버에 연결할 수 없습니다" : "Project 범위를 확인하지 못했습니다"}
          message={scopeError.message}
          retryable={scopeError.retryable}
          onRetry={() => void verifyScope(experiment)}
        />
        <Link className="button button-secondary back-action" href={`/projects/${encodeURIComponent(projectId)}/history`}>
          History로 돌아가기
        </Link>
      </main>
    );
  }

  const resultPages = resultTotal === 0 ? 0 : Math.ceil(resultTotal / RESULT_SIZE);
  const canRun = experiment?.status === "CREATED" && !running && !refreshing;

  return (
    <main className="app-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href={`/projects/${encodeURIComponent(projectId)}`}>Project Overview</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/projects/${encodeURIComponent(projectId)}/history`}>History</Link>
        <span aria-hidden="true">/</span>
        <span>Experiment</span>
      </nav>

      {experiment && scopeVerified ? (
        <>
          <header className="detail-header">
            <div>
              <p className="eyebrow">Inline Experiment</p>
              <h1>Experiment 상세</h1>
              <code title={experiment.id}>{experiment.id}</code>
              <div className="header-actions">
                <Link className="button button-secondary" href={`/projects/${encodeURIComponent(projectId)}/history`}>
                  History로 돌아가기
                </Link>
              </div>
            </div>
            <ExperimentBadge status={experiment.status} />
          </header>

          {refreshing ? <p className="refreshing">Experiment 상태를 다시 확인하고 있습니다.</p> : null}
          {experimentError ? (
            <ErrorState
              title={experimentError.kind === "network" ? "서버에 연결할 수 없습니다" : "상태 조회 실패"}
              message={experimentError.message}
              retryable={experimentError.retryable}
              onRetry={() => void loadExperiment(true, true)}
            />
          ) : null}

          <section className="detail-panel">
            <div className="section-heading">
              <h2>실행 상태</h2>
              <div className="header-actions">
                {experiment.status === "RUNNING" ? (
                  <button className="button button-secondary" type="button" disabled={refreshing} onClick={() => void loadExperiment(true, true)}>
                    상태 다시 확인
                  </button>
                ) : null}
                <button className="button" type="button" disabled={!canRun} onClick={() => void execute()}>
                  {running ? "Inline 실행 중…" : "Inline 실행"}
                </button>
              </div>
            </div>
            <dl className="detail-list">
              <div><dt>전체 Case</dt><dd>{experiment.totalCases}</dd></div>
              <div><dt>PASS</dt><dd>{experiment.passCount}</dd></div>
              <div><dt>FAIL</dt><dd>{experiment.failCount}</dd></div>
              <div><dt>ERROR</dt><dd>{experiment.errorCount}</dd></div>
              <div><dt>완료 시각</dt><dd>{formatLocalDateTime(experiment.completedAt)}</dd></div>
            </dl>
            {experiment.status === "FAILED" ? (
              <p className="form-error" role="alert">
                {experiment.errorCode ?? "EXECUTION_FAILED"}: {experiment.errorMessage ?? "실행을 완료하지 못했습니다."}
              </p>
            ) : null}
            {experiment.status !== "CREATED" ? (
              <p className="immutable-note">이 Experiment는 다시 실행할 수 없습니다.</p>
            ) : null}
          </section>

          {runError ? (
            <ErrorState
              title={runError.kind === "network" ? "서버에 연결할 수 없습니다" : "실행 상태를 확인해 주세요"}
              message={runError.message}
              retryable={runError.retryable}
              onRetry={() => void loadExperiment(true, true)}
            />
          ) : null}

          <section className="overview-section">
            <div className="section-heading">
              <div><p className="eyebrow">Snapshots</p><h2>선택 Version</h2></div>
              {metadataLoading ? <span className="count-label">확인 중…</span> : null}
            </div>
            <dl className="detail-list detail-panel">
              <div>
                <dt>Dataset Version</dt>
                <dd>{metadata.dataset}</dd>
              </div>
              <div>
                <dt>Target Version</dt>
                <dd>
                  {metadata.target ?? <>Target Version 정보 확인 불가<br />ID: <code>{experiment.targetVersionId}</code></>}
                  {metadataErrors.target ? (
                    <span className="metadata-error" role="alert">
                      {metadataErrors.target.message}
                      <button className="text-button" type="button" onClick={() => void resolveMetadata(experiment)}>
                        다시 시도
                      </button>
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Evaluator Version</dt>
                <dd>
                  {metadata.evaluator ?? <>Evaluator Version 정보 확인 불가<br />ID: <code>{experiment.evaluatorVersionId}</code></>}
                  {metadataErrors.evaluator ? (
                    <span className="metadata-error" role="alert">
                      {metadataErrors.evaluator.message}
                      <button className="text-button" type="button" onClick={() => void resolveMetadata(experiment)}>
                        다시 시도
                      </button>
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </section>

          <QualityGatePanel
            projectId={projectId}
            experimentId={experiment.id}
            experimentStatus={experiment.status}
          />

          <BaselineComparisonPanel
            projectId={projectId}
            experiment={experiment}
          />

          <section className="overview-section">
            <div className="section-heading">
              <div><p className="eyebrow">Case Results</p><h2>Evaluation Results</h2></div>
              <span className="count-label">{resultRefreshing ? "갱신 중…" : `전체 ${resultTotal}건`}</span>
            </div>

            {resultLoading && results.length === 0 ? <LoadingState title="Evaluation Result를 불러오고 있습니다" /> : null}
            {resultError ? (
              <ErrorState
                title={resultError.kind === "network" ? "서버에 연결할 수 없습니다" : "Result 조회 실패"}
                message={resultError.message}
                retryable={resultError.retryable}
                onRetry={() => void loadResults(resultPage, results.length > 0)}
              />
            ) : null}
            {!resultLoading && !resultError && results.length === 0 ? (
              <p className="empty-inline">
                {experiment.status === "CREATED" || experiment.status === "RUNNING"
                  ? "실행이 완료되면 Case별 결과가 표시됩니다."
                  : "저장된 Evaluation Result가 없습니다."}
              </p>
            ) : null}

            <div className="result-list">
              {results.map((result, index) => (
                <article className="result-card" key={result.id}>
                  <header>
                    <div>
                      <p className="eyebrow">Case {(resultPage - 1) * RESULT_SIZE + index + 1}</p>
                      <code title={result.datasetVersionCaseId}>{shortId(result.datasetVersionCaseId)}</code>
                    </div>
                    <ResultBadge status={result.status} />
                  </header>
                  <dl className="compact-list">
                    <div><dt>Reason Code</dt><dd>{result.reasonCode ?? "없음"}</dd></div>
                    <div><dt>Reason</dt><dd>{result.reason ?? "없음"}</dd></div>
                    <div><dt>생성</dt><dd>{formatLocalDateTime(result.createdAt)}</dd></div>
                  </dl>
                  <details>
                    <summary>Input Snapshot</summary>
                    <pre className="snapshot-value">{jsonText(result.inputSnapshot)}</pre>
                  </details>
                  <details>
                    <summary>Output Snapshot</summary>
                    <pre className="snapshot-value">{jsonText(result.outputSnapshot)}</pre>
                  </details>
                </article>
              ))}
            </div>

            {resultPages > 0 ? (
              <nav className="pagination" aria-label="Evaluation Result 페이지 이동">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={resultPage <= 1 || resultRefreshing}
                  onClick={() => void loadResults(resultPage - 1, true)}
                >
                  이전
                </button>
                <span>{`전체 ${resultTotal}건 · ${resultPage} / ${resultPages} 페이지`}</span>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={resultPage >= resultPages || resultRefreshing}
                  onClick={() => void loadResults(resultPage + 1, true)}
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
