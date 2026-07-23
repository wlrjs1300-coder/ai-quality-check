'use client';

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/src/components/AsyncStates";
import { ProjectCreateForm } from "@/src/components/ProjectCreateForm";
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
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async (refresh = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (refresh) setRefreshing(true);
    setError(null);

    try {
      const result = await listProjects(controller.signal);
      setProjects(result.data);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(toApiError(loadError));
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      const controller = requestRef.current;
      requestRef.current = null;
      controller?.abort();
    };
  }, [load]);

  async function handleCreated(project: Project) {
    setNotice(`${project.name} Project가 생성되었습니다.`);
    setCreateOpen(false);
    await load(true);
  }

  const isNetworkFailure = error?.kind === "network";

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Evaluation workspace</p>
          <h1>Projects</h1>
          <p className="page-description">새로운 EvalOps 프로젝트를 빠르게 시작하세요.</p>
        </div>
        <button className="button" type="button" onClick={() => setCreateOpen(true)}>
          + Project
        </button>
      </header>

      <ProjectCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {refreshing ? <p className="refreshing" role="status">목록 갱신 중입니다.</p> : null}

      {projects === null && !error ? <LoadingState title="Project 목록을 불러오고 있습니다" /> : null}
      {error ? (
        <ErrorState
          title={isNetworkFailure ? "서버에 연결할 수 없습니다" : "요청 처리 중 오류가 발생했습니다"}
          message={error.message}
          retryable={isNetworkFailure || error.retryable || error.kind === "unexpected"}
          onRetry={() => void load()}
        />
      ) : null}
      {projects?.length === 0 ? <EmptyState onCreate={() => setCreateOpen(true)} /> : null}
      {projects && projects.length > 0 ? (
        <section aria-labelledby="project-list-title">
          <div className="section-heading">
            <h2 id="project-list-title">등록된 Project</h2>
            <span className="count-label">{projects.length}개</span>
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
        </section>
      ) : null}
    </main>
  );
}
