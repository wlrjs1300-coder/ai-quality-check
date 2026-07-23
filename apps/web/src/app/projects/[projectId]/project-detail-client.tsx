"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import { StatusBadge } from "@/src/components/StatusBadge";
import { toApiError, type ApiError } from "@/src/lib/api/errors";
import { getProject, type Project } from "@/src/lib/api/projects";

type ProjectDetailClientProps = {
  projectId: string;
};

export function ProjectDetailClient({ projectId }: ProjectDetailClientProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);

    try {
      const result = await getProject(projectId, controller.signal);
      setProject(result.data);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(toApiError(loadError));
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [projectId]);

  useEffect(() => {
    void load();
    return () => {
      const controller = controllerRef.current;
      controllerRef.current = null;
      controller?.abort();
    };
  }, [load]);

  const notFound = error?.status === 404 || error?.code === "PROJECT_NOT_FOUND";

  return (
    <main className="app-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/projects">Projects</Link><span aria-hidden="true">/</span><span>Detail</span>
      </nav>

      {!project && !error ? <LoadingState title="Project 정보를 불러오고 있습니다" /> : null}
      {error ? (
        <>
          <ErrorState
            message={notFound ? "Project를 찾을 수 없습니다." : error.message}
            retryable={!notFound && (error.retryable || error.kind === "unexpected")}
            onRetry={() => void load()}
          />
          <Link className="button button-secondary back-action" href="/projects">Projects로 돌아가기</Link>
        </>
      ) : null}
      {project ? (
        <>
          <header className="detail-header">
            <div>
              <p className="eyebrow">{project.slug}</p>
              <h1>{project.name}</h1>
              <p className="page-description">{project.description || "설명이 없습니다."}</p>
            </div>
            <StatusBadge active={project.isActive} />
          </header>
          <section className="detail-panel" aria-labelledby="project-information-title">
            <h2 id="project-information-title">Project 정보</h2>
            <dl className="detail-list">
              <div><dt>Project ID</dt><dd><code>{project.id}</code></dd></div>
              <div><dt>Slug</dt><dd>{project.slug}</dd></div>
              <div><dt>상태</dt><dd>{project.isActive ? "활성" : "비활성"}</dd></div>
              <div><dt>생성·수정 시각</dt><dd>현재 단건 API 응답에서 제공되지 않습니다.</dd></div>
            </dl>
          </section>
          <section className="coming-next" aria-labelledby="next-features-title">
            <h2 id="next-features-title">후속 화면 영역</h2>
            <p>Dashboard, Dataset Registry, Target Registry, Evaluator Registry는 다음 Slice에서 연결됩니다.</p>
          </section>
        </>
      ) : null}
    </main>
  );
}
