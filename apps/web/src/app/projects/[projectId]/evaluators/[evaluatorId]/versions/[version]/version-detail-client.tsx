"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import {
  configInput,
  getEvaluator,
  getEvaluatorVersion,
  type Evaluator,
  type EvaluatorVersion,
} from "@/src/lib/api/evaluators";
import { ApiError, toApiError } from "@/src/lib/api/errors";
import { formatLocalDateTime } from "@/src/lib/formatters";

function evaluatorVersionNotFoundError(): ApiError {
  return new ApiError({
    kind: "application",
    status: 404,
    code: "EVALUATOR_VERSION_NOT_FOUND",
    message: "Evaluator Version을 찾을 수 없습니다.",
    retryable: false,
  });
}

export function EvaluatorVersionDetailClient({
  projectId,
  evaluatorId,
  version,
}: {
  projectId: string;
  evaluatorId: string;
  version: string;
}) {
  const [item, setItem] = useState<EvaluatorVersion | null>(null);
  const [evaluator, setEvaluator] = useState<Evaluator | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const requestIdRef = useRef(0);
  const number = Number(version);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setItem(null);
    setEvaluator(null);

    try {
      const results = await Promise.allSettled([
        getEvaluator(evaluatorId),
        getEvaluatorVersion(evaluatorId, number),
      ]);

      if (requestId !== requestIdRef.current) {
        return;
      }

      const scopeMismatch =
        (results[0].status === "fulfilled" && results[0].value.data.projectId !== projectId)
        || (results[1].status === "fulfilled" && results[1].value.data.evaluatorId !== evaluatorId);

      if (scopeMismatch) {
        setError(evaluatorVersionNotFoundError());
      } else {
        if (results[0].status === "fulfilled") {
          setEvaluator(results[0].value.data);
        } else {
          setError(toApiError(results[0].reason));
        }

        if (results[1].status === "fulfilled") {
          setItem(results[1].value.data);
        } else {
          setError(toApiError(results[1].reason));
        }
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setIsInitialLoad(false);
      }
    }
  }, [evaluatorId, number, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    const isNotFound = error.status === 404 || error.code === "EVALUATOR_VERSION_NOT_FOUND";

    return (
      <main className="app-shell">
        <ErrorState
          message={isNotFound ? "Evaluator Version을 찾을 수 없습니다." : error.message}
          retryable={!isNotFound && Boolean(error.retryable)}
          onRetry={isNotFound ? undefined : () => void load()}
        />
        {isNotFound ? (
          <div className="detail-actions">
            <Link
              className="button button-secondary"
              href={`/projects/${projectId}/evaluators/${evaluatorId}`}
            >
              Evaluator 상세로 돌아가기
            </Link>
          </div>
        ) : null}
      </main>
    );
  }

  if (loading || isInitialLoad) {
    return (
      <main className="app-shell">
        <LoadingState />
      </main>
    );
  }
  if (!item || !evaluator) {
    return (
      <main className="app-shell">
        <ErrorState message="목표 데이터를 로드하지 못했습니다." retryable={false} />
      </main>
    );
  }

  const config = configInput(item.evaluatorTypeSnapshot, item.configSnapshot);

  return (
    <main className="app-shell">
      <nav className="breadcrumb">
        <Link href={`/projects/${projectId}/evaluators/${evaluatorId}`}>{evaluator.name}</Link>
        <span>/</span>
        <span>Version {item.version}</span>
      </nav>
      <header className="detail-header">
        <div>
          <p className="eyebrow">Immutable Evaluator Snapshot</p>
          <h1>Evaluator Version {item.version}</h1>
          <p>원본 Evaluator가 변경되거나 비활성화돼도 이 Snapshot은 유지됩니다.</p>
        </div>
      </header>
      <section className="detail-panel">
        <dl className="detail-list">
          <div>
            <dt>Version ID</dt>
            <dd><code>{item.id}</code></dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{item.evaluatorTypeSnapshot}</dd>
          </div>
          <div>
            <dt>
              {item.evaluatorTypeSnapshot === "CONTAINS"
                ? "포함해야 할 문자열"
                : item.evaluatorTypeSnapshot === "NOT_CONTAINS"
                  ? "포함하면 안 되는 문자열"
                  : "Pattern"}
            </dt>
            <dd><code>{config.text}</code></dd>
          </div>
          {item.evaluatorTypeSnapshot === "REGEX" ? (
            <div>
              <dt>Flags</dt>
              <dd>{config.flags.join(", ") || "없음"}</dd>
            </div>
          ) : (
            <div>
              <dt>대소문자 구분</dt>
              <dd>{config.caseSensitive ? "사용" : "사용 안 함"}</dd>
            </div>
          )}
          <div>
            <dt>Content Hash</dt>
            <dd><code>{item.contentHash}</code></dd>
          </div>
          <div>
            <dt>생성</dt>
            <dd>{formatLocalDateTime(item.createdAt)}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
