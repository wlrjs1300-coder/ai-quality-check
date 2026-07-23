export function LoadingState({ title = "로딩 중입니다" }: { title?: string }) {
  return (
    <section className="state-panel" aria-live="polite" aria-busy="true">
      <span className="state-marker" aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>요청을 처리하고 있습니다. 잠시만 기다려 주세요.</p>
      </div>
    </section>
  );
}

type ErrorStateProps = {
  title?: string;
  message: string;
  retryable?: boolean;
  onRetry?: () => void;
};

export function ErrorState({ title, message, retryable = false, onRetry }: ErrorStateProps) {
  return (
    <section className="state-panel state-panel-error" role="alert">
      <div>
        <h2>{title ?? "오류가 발생했습니다."}</h2>
        <p>{message}</p>
      </div>
      {retryable && onRetry ? (
        <button className="button button-secondary" type="button" onClick={onRetry}>
          다시 시도
        </button>
      ) : null}
    </section>
  );
}

type EmptyStateProps = {
  onCreate: () => void;
};

export function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <section className="state-panel">
      <div>
        <h2>등록된 Project가 없습니다</h2>
        <p>먼저 Project를 생성하고 다음 단계를 진행하세요.</p>
      </div>
      <button className="button" type="button" onClick={onCreate}>
        Project 등록
      </button>
    </section>
  );
}
