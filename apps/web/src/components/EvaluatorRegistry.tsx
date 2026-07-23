import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { ErrorState, LoadingState } from "./AsyncStates";
import { StatusBadge } from "./StatusBadge";
import { createEvaluator, listEvaluators, type Evaluator, type EvaluatorType } from "@/src/lib/api/evaluators";
import { toApiError, type ApiError } from "@/src/lib/api/errors";

const FLAGS = ["IGNORECASE", "MULTILINE", "DOTALL"] as const;

export function EvaluatorRegistry({
  projectId,
  projectActive,
}: {
  projectId: string;
  projectActive: boolean;
}) {
  const [items, setItems] = useState<Evaluator[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<EvaluatorType>("CONTAINS");
  const [text, setText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [flags, setFlags] = useState<string[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const size = 20;
  const [total, setTotal] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const hasDataRef = useRef(false);

  const load = useCallback(
    async (nextPage = 1, retainData = false): Promise<void> => {
      const requestId = ++requestIdRef.current;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      if (retainData) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const requestPage = Math.max(1, nextPage);
        const result = await listEvaluators(projectId, requestPage, controller.signal);

        if (requestId !== requestIdRef.current || controllerRef.current !== controller) {
          return;
        }

        const nextSize = Math.max(1, result.pagination.size ?? size);
        const totalPages = result.pagination.total === 0 ? 0 : Math.ceil(result.pagination.total / nextSize);

        if (result.pagination.total > 0 && requestPage > totalPages) {
          setTotal(result.pagination.total);
          setItems([]);
          const clampedPage = Math.max(1, totalPages);
          setPage(clampedPage);
          await load(clampedPage, retainData);
          return;
        }

        setItems(result.data);
        setTotal(result.pagination.total);
        setPage(result.pagination.page);
        hasDataRef.current = result.data.length > 0 || hasDataRef.current;
      } catch (listError) {
        if (controllerRef.current !== controller) {
          return;
        }
        if (listError instanceof DOMException && listError.name === "AbortError") {
          return;
        }
        setError(toApiError(listError));
      } finally {
        if (requestId === requestIdRef.current && controllerRef.current === controller) {
          setLoading(false);
          setRefreshing(false);
          controllerRef.current = null;
        }
      }
    },
    [projectId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  function changeType(next: EvaluatorType) {
    setType(next);
    setText("");
    setCaseSensitive(false);
    setFlags([]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !text.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await createEvaluator(projectId, name.trim(), type, {
        text: text.trim(),
        caseSensitive,
        flags,
      });
      setName("");
      setText("");
      setCaseSensitive(false);
      setFlags([]);
      await load(1, true);
    } catch (submitError) {
      setFormError(toApiError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  function goTo(nextPage: number) {
    void load(nextPage, hasDataRef.current);
  }

  const totalPages = total === 0 ? 0 : Math.ceil(total / size);

  return (
    <section className="overview-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Registry</p>
          <h2>Deterministic Evaluators</h2>
        </div>
        <span>{refreshing ? "갱신 중…" : `${items.length}건 / ${total}건`}</span>
      </div>

      <form className="form-panel case-form" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <label>
            Evaluator 이름
            <input
              value={name}
              disabled={!projectActive || submitting}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label>
            Type
            <select
              value={type}
              disabled={!projectActive || submitting}
              onChange={(event) => changeType(event.target.value as EvaluatorType)}
            >
              <option>CONTAINS</option>
              <option>NOT_CONTAINS</option>
              <option>REGEX</option>
            </select>
          </label>
        </div>
        <label>
          {type === "CONTAINS" ? "포함해야 할 문자열" : type === "NOT_CONTAINS" ? "포함하면 안 되는 문자열" : "Regex Pattern"}
          <input
            value={text}
            disabled={!projectActive || submitting}
            onChange={(event) => setText(event.target.value)}
            required
          />
        </label>
        {type === "REGEX" ? (
          <fieldset className="inline-fieldset">
            <legend>Regex Flags</legend>
            {FLAGS.map((flag) => (
              <label className="checkbox-label" key={flag}>
                <input
                  type="checkbox"
                  checked={flags.includes(flag)}
                  onChange={(event) => {
                    setFlags((current) =>
                      event.target.checked ? [...current, flag] : current.filter((item) => item !== flag),
                    );
                  }}
                />
                {flag}
              </label>
            ))}
          </fieldset>
        ) : (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(event) => setCaseSensitive(event.target.checked)}
            />
            대소문자 구분
          </label>
        )}
        {formError ? (
          <p className="form-error">
            {formError.code === "DUPLICATE_EVALUATOR_NAME_IN_PROJECT"
              ? "같은 이름의 Evaluator가 이미 있습니다."
              : formError.message}
          </p>
        ) : null}
        <div className="form-actions">
          <button
            className="button"
            disabled={!projectActive || submitting || !name.trim() || !text.trim()}
          >
            {submitting ? "생성 중…" : "Evaluator 생성"}
          </button>
        </div>
      </form>

      {loading && items.length === 0 ? <LoadingState title="Evaluator 목록을 불러오고 있습니다" /> : null}
      {error && items.length === 0 ? (
        <ErrorState
          title={error.kind === "network" ? "서버에 연결할 수 없습니다" : undefined}
          message={error.message}
          retryable={error.retryable}
          onRetry={() => void load(page)}
        />
      ) : null}
      {error && items.length > 0 ? (
        <p className="field-error" role="alert">
          목록 갱신 실패: {error.message}
        </p>
      ) : null}
      {!loading && !error && items.length === 0 ? <p className="empty-inline">등록된 Evaluator가 없습니다.</p> : null}

      <div className="registry-grid">
        {items.map((item) => (
          <article className="dataset-card" key={item.id}>
            <div className="card-heading">
              <h3>{item.name}</h3>
              <StatusBadge active={item.isActive} />
            </div>
            <p><strong>{item.evaluatorType}</strong></p>
            <Link className="card-link" href={`/projects/${projectId}/evaluators/${item.id}`}>
              Evaluator 상세 <span>→</span>
            </Link>
          </article>
        ))}
      </div>

      {totalPages > 0 ? (
        <nav className="pagination" aria-label="Evaluator 목록 페이지 이동">
          <button
            className="button button-secondary"
            type="button"
            disabled={page <= 1 || refreshing}
            onClick={() => void goTo(page - 1)}
          >
            이전
          </button>
          <span>{`전체 ${total}건 · ${page} / ${totalPages || 0} 페이지`}</span>
          <button
            className="button button-secondary"
            type="button"
            disabled={totalPages === 0 || page >= totalPages || refreshing}
            onClick={() => void goTo(page + 1)}
          >
            다음
          </button>
        </nav>
      ) : null}
    </section>
  );
}
