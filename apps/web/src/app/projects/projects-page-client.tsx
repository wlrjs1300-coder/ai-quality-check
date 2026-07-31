'use client';

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  InlineActionError,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/src/components/AsyncStates";
import { ProjectCreateForm } from "@/src/components/ProjectCreateForm";
import { PageHeader } from "@/src/components/PageHeader";
import { StatusBadge } from "@/src/components/StatusBadge";
import { toApiError, type ApiError } from "@/src/lib/api/errors";
import { listProjects, type Project } from "@/src/lib/api/projects";

function formatDate(value: string | null): string {
  if (!value) return "미등록";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export function ProjectsPageClient() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const size = 20;

  const load = useCallback(async (requestedPage = 1, retainData = false): Promise<void> => {
    const requestId = ++requestIdRef.current;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (retainData) setRefreshing(true);
    setError(null);

    try {
      const normalizedPage = Math.max(1, requestedPage);
      const result = await listProjects(normalizedPage, controller.signal);
      if (requestId !== requestIdRef.current || requestRef.current !== controller) return;

      const responseSize = Math.max(1, result.pagination.size);
      const responseTotalPages = result.pagination.total === 0
        ? 0
        : Math.ceil(result.pagination.total / responseSize);

      if (result.pagination.total > 0 && normalizedPage > responseTotalPages) {
        setTotal(result.pagination.total);
        await load(responseTotalPages, retainData);
        return;
      }

      setProjects(result.data);
      setPage(result.pagination.total === 0 ? 1 : result.pagination.page);
      setTotal(result.pagination.total);
      hasLoadedRef.current = true;
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      if (requestId === requestIdRef.current && requestRef.current === controller) {
        setError(toApiError(loadError));
      }
    } finally {
      if (requestId === requestIdRef.current && requestRef.current === controller) {
        requestRef.current = null;
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(1);
    return () => {
      requestIdRef.current += 1;
      const controller = requestRef.current;
      requestRef.current = null;
      controller?.abort();
    };
  }, [load]);

  async function handleCreated(project: Project) {
    setNotice(`${project.name} Project가 생성되었습니다.`);
    setCreateOpen(false);
    setPage(1);
    await load(1, true);
  }

  const isNetworkFailure = error?.kind === "network";
  const totalPages = total === 0 ? 0 : Math.ceil(total / size);

  function movePage(nextPage: number) {
    void load(nextPage, hasLoadedRef.current);
  }

  return (
    <main className="app-shell">
      <PageHeader
        eyebrow="Evaluation workspace"
        title="Projects"
        description="새로운 EvalOps 프로젝트를 빠르게 시작하세요."
        actions={(
          <button className="button" type="button" onClick={() => setCreateOpen(true)}>
            + Project
          </button>
        )}
      />

      <ProjectCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {refreshing ? <p className="refreshing" role="status">목록 갱신 중입니다.</p> : null}

      {projects === null && !error ? <LoadingState title="Project 목록을 불러오고 있습니다" /> : null}
      {error && projects === null ? (
        <ErrorState
          title={isNetworkFailure ? "서버에 연결할 수 없습니다" : "요청 처리 중 오류가 발생했습니다"}
          message={error.message}
          retryable={isNetworkFailure || error.retryable || error.kind === "unexpected"}
          onRetry={() => void load(page)}
        />
      ) : null}
      {error && projects !== null ? (
        <InlineActionError
          title="Project 목록을 갱신하지 못했습니다."
          message={error.message}
          onRetry={() => void load(page, true)}
        />
      ) : null}
      {projects?.length === 0 && !error ? <EmptyState onCreate={() => setCreateOpen(true)} /> : null}
      {projects && projects.length > 0 ? (
        <section aria-labelledby="project-list-title">
          <div className="section-heading">
            <h2 id="project-list-title">등록된 Project</h2>
            <span className="count-label">전체 {total}개</span>
          </div>
          <div className="project-grid">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <div className="card-heading">
                  <div>
                    <p className="slug">{project.slug}</p>
                    <h3>{project.name}</h3>
                  </div>
                  <StatusBadge active={project.isActive} />
                </div>
                <p className="card-description">{project.description || "설명 없음"}</p>
                <dl className="card-meta">
                  <div><dt>생성</dt><dd>{formatDate(project.createdAt)}</dd></div>
                </dl>
                <Link className="card-link" href={`/projects/${project.id}`}>
                  상세 보기 <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
          <nav className="pagination" aria-label="Project 목록 페이지 이동">
            <button
              className="button button-secondary"
              type="button"
              disabled={page <= 1 || refreshing}
              onClick={() => movePage(page - 1)}
            >
              이전
            </button>
            <span>{`전체 ${total}건 · ${page} / ${totalPages} 페이지`}</span>
            <button
              className="button button-secondary"
              type="button"
              disabled={page >= totalPages || refreshing}
              onClick={() => movePage(page + 1)}
            >
              다음
            </button>
          </nav>
        </section>
      ) : null}
    </main>
  );
}
