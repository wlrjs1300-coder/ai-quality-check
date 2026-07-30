"use client";

import { ErrorState, InlineActionError } from "@/src/components/AsyncStates";
import { StatusBadge } from "@/src/components/StatusBadge";

export function RuntimeValidationClient() {
  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Development / test only</p>
          <h1>Phase A3 Runtime 상태 검증</h1>
          <p className="page-description">
            실제 제품 컴포넌트의 정상 seed 미렌더링 상태만 재현합니다.
          </p>
        </div>
      </header>

      <section aria-labelledby="inactive-state-title">
        <div className="section-heading">
          <h2 id="inactive-state-title">비활성 상태</h2>
        </div>
        <StatusBadge active={false} />
      </section>

      <section aria-labelledby="error-state-title">
        <div className="section-heading">
          <h2 id="error-state-title">일반 오류 상태</h2>
        </div>
        <ErrorState
          message="Runtime 검증용 고정 오류 메시지입니다."
          retryable
          onRetry={() => undefined}
        />
      </section>

      <section aria-labelledby="download-error-title">
        <div className="section-heading">
          <h2 id="download-error-title">다운로드 오류 상태</h2>
        </div>
        <InlineActionError
          message="Runtime 검증용 고정 다운로드 오류 메시지입니다."
          onRetry={() => undefined}
        />
      </section>
    </main>
  );
}
