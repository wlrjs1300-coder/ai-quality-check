"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import { getHistory } from "@/src/lib/api/analytics";
import { ApiError, toApiError } from "@/src/lib/api/errors";
import type { ExperimentStatus } from "@/src/lib/api/experiments";
import {
  createQualityGatePolicy,
  evaluateQualityGate,
  getQualityGatePolicy,
  getQualityGateResult,
  type QualityGatePolicy,
  type QualityGateResult,
} from "@/src/lib/api/gates";
import { formatLocalDateTime, formatRate } from "@/src/lib/formatters";

const HISTORY_SIZE = 100;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function scopeError(message: string): ApiError {
  return new ApiError({
    kind: "application",
    status: 404,
    code: "QUALITY_GATE_SCOPE_MISMATCH",
    message,
  });
}

function GateBadge({ status }: { status: QualityGateResult["status"] }) {
  const tone = status === "PASS" ? "positive" : "negative";
  return <span className={`semantic-badge semantic-${tone}`}>{status}</span>;
}

async function findLatestResultId(
  projectId: string,
  experimentId: string,
  signal: AbortSignal,
): Promise<string | null> {
  let page = 1;
  while (true) {
    const response = await getHistory(projectId, {
      page,
      size: HISTORY_SIZE,
      experimentStatus: null,
      gateStatus: null,
      comparisonStatus: null,
      createdFrom: null,
      createdTo: null,
      sort: "created_at_desc",
    }, signal);
    const experiment = response.data.find((item) => item.experimentId === experimentId);
    if (experiment) return experiment.qualityGateResult?.resultId ?? null;

    const totalPages = response.pagination.total === 0
      ? 0
      : Math.ceil(response.pagination.total / Math.max(1, response.pagination.size));
    if (page >= totalPages) return null;
    page += 1;
  }
}

export function QualityGatePanel({
  projectId,
  experimentId,
  experimentStatus,
}: {
  projectId: string;
  experimentId: string;
  experimentStatus: ExperimentStatus;
}) {
  const [name, setName] = useState("release-gate");
  const [minimumPassRate, setMinimumPassRate] = useState("95");
  const [blockOnError, setBlockOnError] = useState(true);
  const [blockOnRequiredCaseFailure, setBlockOnRequiredCaseFailure] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<QualityGatePolicy | null>(null);
  const [result, setResult] = useState<QualityGateResult | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<ApiError | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<ApiError | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<ApiError | null>(null);
  const [recovering, setRecovering] = useState(false);

  const restoreControllerRef = useRef<AbortController | null>(null);
  const restoreRequestIdRef = useRef(0);
  const mutationControllerRef = useRef<AbortController | null>(null);
  const mutationRequestIdRef = useRef(0);

  const restoreLatest = useCallback(async (showLoading = true): Promise<boolean> => {
    const requestId = ++restoreRequestIdRef.current;
    restoreControllerRef.current?.abort();
    const controller = new AbortController();
    restoreControllerRef.current = controller;
    if (showLoading) setRestoring(true);
    setRestoreError(null);

    try {
      const resultId = await findLatestResultId(projectId, experimentId, controller.signal);
      if (requestId !== restoreRequestIdRef.current || restoreControllerRef.current !== controller) {
        return false;
      }
      if (resultId === null) {
        setResult(null);
        return false;
      }

      const resultResponse = await getQualityGateResult(resultId, controller.signal);
      if (resultResponse.data.experimentId !== experimentId) {
        throw scopeError("현재 Experiment의 Quality Gate Result가 아닙니다.");
      }
      const policyResponse = await getQualityGatePolicy(
        resultResponse.data.policyId,
        controller.signal,
      );
      if (policyResponse.data.projectId !== projectId) {
        throw scopeError("현재 Project의 Quality Gate Policy를 찾을 수 없습니다.");
      }
      if (requestId !== restoreRequestIdRef.current || restoreControllerRef.current !== controller) {
        return false;
      }
      setPolicy(policyResponse.data);
      setResult(resultResponse.data);
      setEvaluationError(null);
      return true;
    } catch (error) {
      if (restoreControllerRef.current !== controller || isAbortError(error)) return false;
      setRestoreError(toApiError(error));
      return false;
    } finally {
      if (requestId === restoreRequestIdRef.current && restoreControllerRef.current === controller) {
        setRestoring(false);
        setRecovering(false);
        restoreControllerRef.current = null;
      }
    }
  }, [experimentId, projectId]);

  useEffect(() => {
    void restoreLatest(true);
    return () => {
      restoreControllerRef.current?.abort();
      mutationControllerRef.current?.abort();
    };
  }, [restoreLatest]);

  async function evaluateExistingPolicy(currentPolicy: QualityGatePolicy) {
    const requestId = ++mutationRequestIdRef.current;
    mutationControllerRef.current?.abort();
    const controller = new AbortController();
    mutationControllerRef.current = controller;
    setEvaluating(true);
    setEvaluationError(null);

    try {
      const response = await evaluateQualityGate(
        currentPolicy.id,
        experimentId,
        controller.signal,
      );
      if (requestId !== mutationRequestIdRef.current || mutationControllerRef.current !== controller) {
        return;
      }
      setResult(response.data);
    } catch (error) {
      if (mutationControllerRef.current !== controller || isAbortError(error)) return;
      const apiError = toApiError(error);
      setEvaluationError(apiError);
      setRecovering(true);
      const recovered = await restoreLatest(false);
      if (!recovered) setEvaluationError(apiError);
    } finally {
      if (requestId === mutationRequestIdRef.current && mutationControllerRef.current === controller) {
        setEvaluating(false);
        mutationControllerRef.current = null;
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating || evaluating || recovering || result) return;

    const trimmedName = name.trim();
    const parsedRate = Number(minimumPassRate);
    const nextNameError = trimmedName.length === 0
      ? "Policy 이름을 입력해 주세요."
      : trimmedName.length > 120
        ? "Policy 이름은 120자 이하여야 합니다."
        : null;
    const nextRateError = minimumPassRate.trim() === "" || !Number.isFinite(parsedRate)
      ? "Minimum Pass Rate를 입력해 주세요."
      : parsedRate < 0 || parsedRate > 100
        ? "Minimum Pass Rate는 0% 이상 100% 이하여야 합니다."
        : null;
    setNameError(nextNameError);
    setRateError(nextRateError);
    setCreateError(null);
    if (nextNameError || nextRateError || experimentStatus !== "COMPLETED") return;

    const requestId = ++mutationRequestIdRef.current;
    mutationControllerRef.current?.abort();
    const controller = new AbortController();
    mutationControllerRef.current = controller;
    setCreating(true);

    try {
      const response = await createQualityGatePolicy(projectId, {
        name: trimmedName,
        minimum_pass_rate: parsedRate / 100,
        block_on_error: blockOnError,
        block_on_required_case_failure: blockOnRequiredCaseFailure,
      }, controller.signal);
      if (requestId !== mutationRequestIdRef.current || mutationControllerRef.current !== controller) {
        return;
      }
      if (response.data.projectId !== projectId) {
        setCreateError(scopeError("생성된 Policy의 Project 범위가 일치하지 않습니다."));
        return;
      }
      setPolicy(response.data);
      setCreating(false);
      mutationControllerRef.current = null;
      await evaluateExistingPolicy(response.data);
    } catch (error) {
      if (mutationControllerRef.current !== controller || isAbortError(error)) return;
      setCreateError(toApiError(error));
    } finally {
      if (requestId === mutationRequestIdRef.current && mutationControllerRef.current === controller) {
        setCreating(false);
        mutationControllerRef.current = null;
      }
    }
  }

  const disabledReason = experimentStatus === "CREATED"
    ? "Experiment 실행 완료 후 Quality Gate를 평가할 수 있습니다."
    : experimentStatus === "RUNNING"
      ? "Experiment 실행이 완료될 때까지 기다려 주세요."
      : experimentStatus === "FAILED"
        ? "완료된 Experiment만 Quality Gate를 평가할 수 있습니다."
        : null;
  const busy = creating || evaluating || recovering;
  const duplicateName = createError?.code === "DUPLICATE_QUALITY_GATE_POLICY_NAME_IN_PROJECT";

  return (
    <section className="overview-section gate-panel" aria-labelledby="quality-gate-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Release Decision</p>
          <h2 id="quality-gate-title">Basic Quality Gate</h2>
        </div>
        {result ? <GateBadge status={result.status} /> : null}
      </div>

      {restoring ? <LoadingState title="최신 Quality Gate Result를 확인하고 있습니다" /> : null}
      {restoreError ? (
        <ErrorState
          title={restoreError.kind === "network" ? "서버에 연결할 수 없습니다" : "Gate 결과를 불러오지 못했습니다"}
          message={restoreError.message}
          retryable
          onRetry={() => void restoreLatest(true)}
        />
      ) : null}

      {!restoring && !restoreError && result && policy ? (
        <div className="detail-panel">
          <dl className="detail-list">
            <div><dt>Gate Status</dt><dd><GateBadge status={result.status} /></dd></div>
            <div><dt>Policy</dt><dd>{policy.name}</dd></div>
            <div><dt>Policy ID</dt><dd><code>{policy.id}</code></dd></div>
            <div><dt>Minimum Pass Rate</dt><dd>{formatRate(policy.minimumPassRate)}</dd></div>
            <div><dt>ERROR 차단</dt><dd>{policy.blockOnError ? "사용" : "사용 안 함"}</dd></div>
            <div><dt>필수 Case 실패 차단</dt><dd>{policy.blockOnRequiredCaseFailure ? "사용" : "사용 안 함"}</dd></div>
            <div><dt>Backend Pass Rate</dt><dd>{formatRate(result.passRate)}</dd></div>
            <div><dt>전체 Case</dt><dd>{result.totalCaseCount}</dd></div>
            <div><dt>PASS</dt><dd>{result.passedCaseCount}</dd></div>
            <div><dt>FAIL</dt><dd>{result.failedCaseCount}</dd></div>
            <div><dt>ERROR</dt><dd>{result.errorCaseCount}</dd></div>
            <div><dt>필수 Case 실패</dt><dd>{result.requiredCaseFailureCount}</dd></div>
            <div>
              <dt>Reason Codes</dt>
              <dd className="gate-reasons">
                {result.reasonCodes.length > 0
                  ? result.reasonCodes.map((code) => <span className="semantic-badge semantic-neutral" key={code}>{code}</span>)
                  : "없음"}
              </dd>
            </div>
            <div><dt>Reason Summary</dt><dd>{result.reasonSummary ?? "없음"}</dd></div>
            <div><dt>평가 시각</dt><dd>{formatLocalDateTime(result.createdAt)}</dd></div>
          </dl>
          <p className="immutable-note">
            최신 Gate Result만 표시합니다. 현재 API는 전체 Gate 평가 이력을 제공하지 않습니다.
          </p>
        </div>
      ) : null}

      {!restoring && !restoreError && !result ? (
        <form className="detail-panel gate-form" aria-busy={busy} onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <label htmlFor="gate-policy-name">
              Policy 이름
              <input
                id="gate-policy-name"
                value={name}
                maxLength={120}
                disabled={busy || experimentStatus !== "COMPLETED" || policy !== null}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(null);
                }}
              />
              <span className="field-error" role={nameError || duplicateName ? "alert" : undefined}>
                {nameError ?? (duplicateName ? createError.message : "")}
              </span>
            </label>
            <label htmlFor="gate-minimum-pass-rate">
              Minimum Pass Rate (%)
              <input
                id="gate-minimum-pass-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={minimumPassRate}
                disabled={busy || experimentStatus !== "COMPLETED" || policy !== null}
                onChange={(event) => {
                  setMinimumPassRate(event.target.value);
                  setRateError(null);
                }}
              />
              <span className="field-error" role={rateError ? "alert" : undefined}>{rateError ?? ""}</span>
            </label>
          </div>

          <div className="gate-options">
            <label className="checkbox-label" htmlFor="gate-block-error">
              <input
                id="gate-block-error"
                type="checkbox"
                checked={blockOnError}
                disabled={busy || experimentStatus !== "COMPLETED" || policy !== null}
                aria-describedby="gate-block-error-help"
                onChange={(event) => setBlockOnError(event.target.checked)}
              />
              ERROR Result가 하나라도 있으면 BLOCK
            </label>
            <p id="gate-block-error-help">실행 오류를 배포 차단 조건으로 사용합니다.</p>
            <label className="checkbox-label" htmlFor="gate-block-required">
              <input
                id="gate-block-required"
                type="checkbox"
                checked={blockOnRequiredCaseFailure}
                disabled={busy || experimentStatus !== "COMPLETED" || policy !== null}
                aria-describedby="gate-block-required-help"
                onChange={(event) => setBlockOnRequiredCaseFailure(event.target.checked)}
              />
              필수 Release Case가 실패하면 BLOCK
            </label>
            <p id="gate-block-required-help">required_for_release로 지정된 Case의 실패를 검사합니다.</p>
          </div>

          <p className="immutable-note">
            Severity 자체를 기준으로 한 차단 Rule은 현재 지원하지 않습니다.
          </p>
          {disabledReason ? <p className="immutable-note">{disabledReason}</p> : null}
          {createError && !duplicateName ? (
            <p className="form-error" role="alert">
              {createError.kind === "network"
                ? "정책 생성 결과를 확인할 수 없습니다. 수동 재시도 시 같은 이름의 Policy가 이미 생성되어 중복 오류가 발생할 수 있습니다."
                : createError.message}
            </p>
          ) : null}
          {evaluationError ? (
            <p className="form-error" role="alert">{evaluationError.message}</p>
          ) : null}
          <div className="header-actions">
            {policy && evaluationError && !recovering ? (
              <button
                className="button button-secondary"
                type="button"
                disabled={busy}
                onClick={() => void evaluateExistingPolicy(policy)}
              >
                기존 Policy로 평가 다시 시도
              </button>
            ) : null}
            {!policy ? (
              <button
                className="button"
                type="submit"
                disabled={busy || experimentStatus !== "COMPLETED"}
              >
                {creating ? "Policy 생성 중…" : evaluating ? "평가 중…" : "Policy 생성 후 평가"}
              </button>
            ) : null}
          </div>
          {recovering ? <p className="refreshing">평가 결과가 저장되었는지 History에서 확인하고 있습니다.</p> : null}
          {evaluating && !recovering ? <p className="refreshing">생성된 Policy로 Quality Gate를 평가하고 있습니다.</p> : null}
        </form>
      ) : null}
    </section>
  );
}
