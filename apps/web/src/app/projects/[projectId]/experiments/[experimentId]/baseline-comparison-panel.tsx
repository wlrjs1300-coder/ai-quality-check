"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { SemanticBadge } from "@/src/components/AnalyticsUi";
import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import {
  getHistory,
  type ExperimentHistoryItem,
} from "@/src/lib/api/analytics";
import {
  createBaselineComparison,
  getBaselineComparison,
  type BaselineComparison,
} from "@/src/lib/api/comparisons";
import { ApiError, toApiError, type ApiErrorKind } from "@/src/lib/api/errors";
import type { Experiment } from "@/src/lib/api/experiments";
import {
  formatLocalDateTime,
  formatRate,
  shortId,
} from "@/src/lib/formatters";

const HISTORY_SIZE = 100;

type HistorySnapshot = {
  current: ExperimentHistoryItem | null;
  candidates: ExperimentHistoryItem[];
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function localError(
  code: string,
  message: string,
  kind: ApiErrorKind = "application",
): ApiError {
  return new ApiError({
    kind,
    status: kind === "unexpected" ? null : 409,
    code,
    message,
  });
}

async function loadHistorySnapshot(
  projectId: string,
  experiment: Experiment,
  signal: AbortSignal,
): Promise<HistorySnapshot> {
  const items: ExperimentHistoryItem[] = [];
  let page = 1;
  while (true) {
    const response = await getHistory(projectId, {
      page,
      size: HISTORY_SIZE,
      experimentStatus: "COMPLETED",
      gateStatus: null,
      comparisonStatus: null,
      createdFrom: null,
      createdTo: null,
      sort: "created_at_desc",
    }, signal);
    items.push(...response.data);
    const totalPages = response.pagination.total === 0
      ? 0
      : Math.ceil(response.pagination.total / Math.max(1, response.pagination.size));
    if (page >= totalPages) break;
    page += 1;
  }

  const current = items.find((item) => item.experimentId === experiment.id) ?? null;
  const unique = new Map<string, ExperimentHistoryItem>();
  for (const item of items) {
    if (
      item.experimentId !== experiment.id
      && item.datasetVersionId === experiment.datasetVersionId
      && item.experimentStatus === "COMPLETED"
      && item.totalCaseCount > 0
      && !unique.has(item.experimentId)
    ) {
      unique.set(item.experimentId, item);
    }
  }
  return { current, candidates: [...unique.values()] };
}

function comparisonPath(projectId: string, comparisonId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/comparisons/${encodeURIComponent(comparisonId)}`;
}

export function BaselineComparisonPanel({
  projectId,
  experiment,
}: {
  projectId: string;
  experiment: Experiment;
}) {
  const router = useRouter();
  const [currentHistory, setCurrentHistory] = useState<ExperimentHistoryItem | null>(null);
  const [candidates, setCandidates] = useState<ExperimentHistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [refreshingCandidates, setRefreshingCandidates] = useState(false);
  const [candidateError, setCandidateError] = useState<ApiError | null>(null);
  const [comparing, setComparing] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [comparisonError, setComparisonError] = useState<ApiError | null>(null);

  const candidateControllerRef = useRef<AbortController | null>(null);
  const candidateRequestIdRef = useRef(0);
  const mutationControllerRef = useRef<AbortController | null>(null);
  const mutationRequestIdRef = useRef(0);

  const loadCandidates = useCallback(async (retainData = false): Promise<HistorySnapshot | null> => {
    if (experiment.status !== "COMPLETED") {
      setCandidates([]);
      setCurrentHistory(null);
      return null;
    }
    const requestId = ++candidateRequestIdRef.current;
    candidateControllerRef.current?.abort();
    const controller = new AbortController();
    candidateControllerRef.current = controller;
    setCandidateError(null);
    if (retainData) setRefreshingCandidates(true);
    else setLoadingCandidates(true);

    try {
      const snapshot = await loadHistorySnapshot(projectId, experiment, controller.signal);
      if (
        requestId !== candidateRequestIdRef.current
        || candidateControllerRef.current !== controller
      ) {
        return null;
      }
      setCurrentHistory(snapshot.current);
      setCandidates(snapshot.candidates);
      setSelectedId((current) => (
        snapshot.candidates.some((item) => item.experimentId === current) ? current : ""
      ));
      return snapshot;
    } catch (error) {
      if (candidateControllerRef.current !== controller || isAbortError(error)) return null;
      setCandidateError(toApiError(error));
      return null;
    } finally {
      if (
        requestId === candidateRequestIdRef.current
        && candidateControllerRef.current === controller
      ) {
        setLoadingCandidates(false);
        setRefreshingCandidates(false);
        candidateControllerRef.current = null;
      }
    }
  }, [experiment, projectId]);

  useEffect(() => {
    void loadCandidates(false);
    return () => {
      candidateControllerRef.current?.abort();
      mutationControllerRef.current?.abort();
    };
  }, [loadCandidates]);

  async function recoverComparison(
    baselineExperimentId: string,
    controller: AbortController,
  ): Promise<BaselineComparison | null> {
    setRecovering(true);
    try {
      const snapshot = await loadHistorySnapshot(projectId, experiment, controller.signal);
      const comparisonId = snapshot.current?.baselineComparison?.comparisonId;
      if (!comparisonId) return null;
      const response = await getBaselineComparison(comparisonId, controller.signal);
      const comparison = response.data;
      if (
        comparison.projectId === projectId
        && comparison.baselineExperimentId === baselineExperimentId
        && comparison.currentExperimentId === experiment.id
      ) {
        return comparison;
      }
      return null;
    } finally {
      setRecovering(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      experiment.status !== "COMPLETED"
      || !selectedId
      || comparing
      || recovering
    ) {
      return;
    }

    const baselineExperimentId = selectedId;
    const requestId = ++mutationRequestIdRef.current;
    mutationControllerRef.current?.abort();
    const controller = new AbortController();
    mutationControllerRef.current = controller;
    setComparing(true);
    setComparisonError(null);

    try {
      const response = await createBaselineComparison(
        baselineExperimentId,
        experiment.id,
        controller.signal,
      );
      if (
        requestId !== mutationRequestIdRef.current
        || mutationControllerRef.current !== controller
      ) {
        return;
      }
      const comparison = response.data;
      if (
        comparison.projectId !== projectId
        || comparison.baselineExperimentId !== baselineExperimentId
        || comparison.currentExperimentId !== experiment.id
      ) {
        setComparisonError(localError(
          "BASELINE_COMPARISON_SCOPE_MISMATCH",
          "생성된 Comparison의 Project 또는 Experiment 범위가 일치하지 않습니다.",
          "unexpected",
        ));
        return;
      }
      router.push(comparisonPath(projectId, comparison.id));
    } catch (error) {
      if (mutationControllerRef.current !== controller || isAbortError(error)) return;
      const apiError = toApiError(error);
      if (
        apiError.kind === "network"
        || apiError.code === "BASELINE_COMPARISON_ALREADY_EXISTS"
      ) {
        try {
          const recovered = await recoverComparison(baselineExperimentId, controller);
          if (recovered) {
            router.push(comparisonPath(projectId, recovered.id));
            return;
          }
          setComparisonError(localError(
            "BASELINE_COMPARISON_RECOVERY_UNAVAILABLE",
            "기존 Comparison ID를 확인할 수 없습니다. History에는 현재 Experiment의 최신 Comparison만 제공됩니다.",
          ));
        } catch (recoveryError) {
          if (isAbortError(recoveryError)) return;
          setComparisonError(toApiError(recoveryError));
        }
      } else {
        setComparisonError(apiError);
        if (
          apiError.code === "BASELINE_EXPERIMENT_NOT_FOUND"
          || apiError.code === "BASELINE_EXPERIMENT_NOT_COMPLETED"
          || apiError.code === "BASELINE_COMPARISON_PROJECT_MISMATCH"
          || apiError.code === "BASELINE_DATASET_VERSION_MISMATCH"
        ) {
          setSelectedId("");
          void loadCandidates(true);
        }
      }
    } finally {
      if (
        requestId === mutationRequestIdRef.current
        && mutationControllerRef.current === controller
      ) {
        setComparing(false);
        mutationControllerRef.current = null;
      }
    }
  }

  const disabledReason = experiment.status === "CREATED"
    ? "Experiment 실행 완료 후 비교할 수 있습니다."
    : experiment.status === "RUNNING"
      ? "Experiment 실행 완료를 기다리고 있습니다."
      : experiment.status === "FAILED"
        ? "완료된 Experiment만 Baseline과 비교할 수 있습니다."
        : null;
  const busy = comparing || recovering;

  return (
    <section className="overview-section comparison-panel" aria-labelledby="baseline-comparison-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Regression Analysis</p>
          <h2 id="baseline-comparison-title">Baseline Comparison</h2>
        </div>
        {refreshingCandidates ? <span className="count-label">후보 갱신 중…</span> : null}
      </div>

      <div className="detail-panel">
        <h3>Current Experiment</h3>
        <dl className="detail-list">
          <div><dt>Experiment ID</dt><dd><code>{experiment.id}</code></dd></div>
          <div><dt>Dataset Version</dt><dd><code>{experiment.datasetVersionId}</code></dd></div>
          <div><dt>Pass Rate</dt><dd>{formatRate(currentHistory?.passRate ?? null)}</dd></div>
          <div>
            <dt>PASS / FAIL / ERROR</dt>
            <dd>{experiment.passCount} / {experiment.failCount} / {experiment.errorCount}</dd>
          </div>
          <div><dt>생성</dt><dd>{currentHistory ? formatLocalDateTime(currentHistory.createdAt) : "확인 불가"}</dd></div>
          <div><dt>완료</dt><dd>{formatLocalDateTime(experiment.completedAt)}</dd></div>
        </dl>
        {disabledReason ? <p className="immutable-note">{disabledReason}</p> : null}
      </div>

      {experiment.status === "COMPLETED" ? (
        <form className="comparison-form" aria-busy={busy} onSubmit={(event) => void submit(event)}>
          {loadingCandidates && candidates.length === 0 ? (
            <LoadingState title="Baseline 후보를 불러오고 있습니다" />
          ) : null}
          {candidateError ? (
            <ErrorState
              title={candidateError.kind === "network" ? "서버에 연결할 수 없습니다" : "Baseline 후보 조회 실패"}
              message={candidateError.message}
              retryable
              onRetry={() => void loadCandidates(candidates.length > 0)}
            />
          ) : null}
          {!loadingCandidates && !candidateError && candidates.length === 0 ? (
            <div className="state-panel">
              <div>
                <h3>비교 가능한 Baseline Experiment가 없습니다.</h3>
                <p>같은 Dataset Version으로 완료된 다른 Experiment가 필요합니다.</p>
              </div>
            </div>
          ) : null}

          {candidates.length > 0 ? (
            <fieldset className="baseline-candidates" disabled={busy}>
              <legend>Baseline Experiment 선택</legend>
              <p className="muted">
                같은 Project와 Dataset Version의 완료된 Experiment만 표시합니다.
              </p>
              <div className="baseline-candidate-list">
                {candidates.map((candidate, index) => {
                  const inputId = `baseline-candidate-${index}`;
                  const selected = selectedId === candidate.experimentId;
                  return (
                    <label
                      className={`baseline-candidate${selected ? " baseline-candidate-selected" : ""}`}
                      htmlFor={inputId}
                      key={candidate.experimentId}
                    >
                      <span className="baseline-candidate-heading">
                        <input
                          id={inputId}
                          type="radio"
                          name="baseline-experiment"
                          value={candidate.experimentId}
                          checked={selected}
                          aria-describedby={`${inputId}-description`}
                          onChange={() => {
                            setSelectedId(candidate.experimentId);
                            setComparisonError(null);
                          }}
                        />
                        <span>
                          <strong title={candidate.experimentId}>{shortId(candidate.experimentId)}</strong>
                          <small>{selected ? "선택됨" : "선택 가능"}</small>
                        </span>
                      </span>
                      <span id={`${inputId}-description`} className="baseline-candidate-details">
                        <span>Pass Rate {formatRate(candidate.passRate)}</span>
                        <span>PASS {candidate.passedCaseCount} · FAIL {candidate.failedCaseCount} · ERROR {candidate.errorCaseCount}</span>
                        <span>생성 {formatLocalDateTime(candidate.createdAt)}</span>
                        <span>완료 {formatLocalDateTime(candidate.completedAt)}</span>
                        <span>Gate <SemanticBadge status={candidate.qualityGateResult?.status ?? null} /></span>
                        <span>Comparison <SemanticBadge status={candidate.baselineComparison?.status ?? null} /></span>
                        <span>Dataset <code>{shortId(candidate.datasetVersionId)}</code></span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {comparisonError ? (
            <p className="form-error" role="alert">
              {comparisonError.code === "BASELINE_RESULT_SET_MISMATCH"
                ? "두 Experiment의 Case 결과 집합이 일치하지 않아 비교할 수 없습니다."
                : comparisonError.code === "EMPTY_EXPERIMENT_RESULTS"
                  ? "실행 결과가 존재하는 완료 Experiment가 필요합니다."
                  : comparisonError.code === "CURRENT_EXPERIMENT_NOT_COMPLETED"
                    ? "현재 Experiment 상태를 다시 확인한 뒤 시도해 주세요."
                    : comparisonError.message}
            </p>
          ) : null}

          <div className="header-actions">
            <button
              className="button"
              type="submit"
              disabled={!selectedId || busy || loadingCandidates}
            >
              {comparing ? "Comparison 생성 중…" : recovering ? "기존 Comparison 확인 중…" : "Comparison 생성"}
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={busy || loadingCandidates || refreshingCandidates}
              onClick={() => void loadCandidates(candidates.length > 0)}
            >
              후보 다시 확인
            </button>
          </div>
          {!selectedId && candidates.length > 0 ? (
            <p className="immutable-note">Baseline을 선택해야 Comparison을 생성할 수 있습니다.</p>
          ) : null}
          {recovering ? (
            <p className="refreshing">History에서 기존 Comparison을 확인하고 있습니다.</p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
