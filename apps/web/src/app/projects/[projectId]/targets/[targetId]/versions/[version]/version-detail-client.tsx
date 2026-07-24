"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import {
  fixedResponse,
  getTarget,
  getTargetVersion,
  type Target,
  type TargetVersion,
} from "@/src/lib/api/targets";
import { ApiError, toApiError } from "@/src/lib/api/errors";
import { formatLocalDateTime } from "@/src/lib/formatters";

function targetVersionNotFoundError(): ApiError {
  return new ApiError({
    kind: "application",
    status: 404,
    code: "TARGET_VERSION_NOT_FOUND",
    message: "Target Version을 찾을 수 없습니다.",
    retryable: false,
  });
}

export function TargetVersionDetailClient({
  projectId,
  targetId,
  version,
}: {
  projectId: string;
  targetId: string;
  version: string;
}) {
  const [item, setItem] = useState<TargetVersion | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
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
    setTarget(null);

    try {
      const result = await Promise.allSettled([
        getTarget(targetId),
        getTargetVersion(targetId, number),
      ]);

      if (requestId !== requestIdRef.current) {
        return;
      }

      const scopeMismatch =
        (result[0].status === "fulfilled" && result[0].value.data.projectId !== projectId)
        || (result[1].status === "fulfilled" && result[1].value.data.targetId !== targetId);

      if (scopeMismatch) {
        setError(targetVersionNotFoundError());
      } else {
        if (result[0].status === "fulfilled") {
          setTarget(result[0].value.data);
        } else {
          setError(toApiError(result[0].reason));
        }

        if (result[1].status === "fulfilled") {
          setItem(result[1].value.data);
        } else {
          setError(toApiError(result[1].reason));
        }
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setIsInitialLoad(false);
      }
    }
  }, [targetId, number, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    const isNotFound = error.status === 404 || error.code === "TARGET_VERSION_NOT_FOUND";

    return (
      <main className="app-shell">
        <ErrorState
          message={isNotFound ? "Target Version을 찾을 수 없습니다." : error.message}
          retryable={!isNotFound && Boolean(error.retryable)}
          onRetry={isNotFound ? undefined : () => void load()}
        />
        {isNotFound ? (
          <div className="detail-actions">
            <Link className="button button-secondary" href={`/projects/${projectId}/targets/${targetId}`}>
              Target 상세로 돌아가기
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

  if (!item || !target) {
    return (
      <main className="app-shell">
        <ErrorState message="목표 데이터를 로드하지 못했습니다." retryable={false} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <nav className="breadcrumb">
        <Link href={`/projects/${projectId}/targets/${targetId}`}>{target.name}</Link>
        <span>/</span>
        <span>Version {item.version}</span>
      </nav>
      <header className="detail-header">
        <div>
          <p className="eyebrow">Immutable FIXED Snapshot</p>
          <h1>Target Version {item.version}</h1>
          <p>원본 Target 설정이 변경되거나 비활성화돼도 이 Snapshot은 유지됩니다.</p>
        </div>
      </header>
      <section className="detail-panel">
        <dl className="detail-list">
          <div>
            <dt>Version ID</dt>
            <dd><code>{item.id}</code></dd>
          </div>
          <div>
            <dt>Target Type</dt>
            <dd>MOCK</dd>
          </div>
          <div>
            <dt>Response Strategy</dt>
            <dd>{item.responseStrategy}</dd>
          </div>
          <div>
            <dt>고정 응답</dt>
            <dd>{fixedResponse(item.configSnapshot) ?? "설정 없음"}</dd>
          </div>
          <div>
            <dt>Latency</dt>
            <dd>{item.latencyMs}ms</dd>
          </div>
          <div>
            <dt>Failure Rate</dt>
            <dd>{(item.failureRate * 100).toFixed(2)}%</dd>
          </div>
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
