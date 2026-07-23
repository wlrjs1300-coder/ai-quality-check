"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { ErrorState, LoadingState } from "@/src/components/AsyncStates";
import {
  listDatasets,
  listDatasetVersions,
  type Dataset,
  type DatasetVersion,
} from "@/src/lib/api/datasets";
import { toApiError, type ApiError } from "@/src/lib/api/errors";
import {
  listEvaluators,
  listEvaluatorVersions,
  type Evaluator,
  type EvaluatorVersion,
} from "@/src/lib/api/evaluators";
import { createExperiment } from "@/src/lib/api/experiments";
import { getProject, type Project } from "@/src/lib/api/projects";
import {
  listTargets,
  listTargetVersions,
  type Target,
  type TargetVersion,
} from "@/src/lib/api/targets";
import type { PaginatedResult } from "@/src/lib/api/types";

const PAGE_SIZE = 20;

type PageState<T> = {
  items: T[];
  page: number;
  total: number;
  size: number;
  loading: boolean;
  refreshing: boolean;
  error: ApiError | null;
};

type PageResource<T> = PageState<T> & {
  load: (page?: number, retainData?: boolean) => Promise<void>;
};

function usePageResource<T>(
  enabled: boolean,
  key: string,
  loader: (page: number, signal: AbortSignal) => Promise<PaginatedResult<T>>,
): PageResource<T> {
  const [state, setState] = useState<PageState<T>>({
    items: [],
    page: 1,
    total: 0,
    size: PAGE_SIZE,
    loading: enabled,
    refreshing: false,
    error: null,
  });
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (page = 1, retainData = false) => {
    if (!enabled) {
      setState({
        items: [],
        page: 1,
        total: 0,
        size: PAGE_SIZE,
        loading: false,
        refreshing: false,
        error: null,
      });
      return;
    }

    const requestId = ++requestIdRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestedPage = Math.max(1, page);

    setState((current) => ({
      ...current,
      loading: !retainData,
      refreshing: retainData,
      error: null,
    }));

    try {
      const result = await loader(requestedPage, controller.signal);
      if (requestId !== requestIdRef.current || controllerRef.current !== controller) {
        return;
      }
      setState({
        items: result.data,
        page: result.pagination.page,
        total: result.pagination.total,
        size: result.pagination.size,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (error) {
      if (controllerRef.current !== controller) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: toApiError(error),
      }));
    } finally {
      if (requestId === requestIdRef.current && controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }, [enabled, loader]);

  useEffect(() => {
    void load(1, false);
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [key, load]);

  return { ...state, load };
}

type SelectorProps<T> = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  resource: PageResource<T>;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  disabledItem?: (item: T) => boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
};

function PaginatedSelector<T>({
  id,
  label,
  value,
  placeholder,
  resource,
  getId,
  getLabel,
  disabledItem,
  disabled = false,
  onChange,
}: SelectorProps<T>) {
  const totalPages = resource.total === 0
    ? 0
    : Math.ceil(resource.total / Math.max(1, resource.size));

  return (
    <div className="version-picker">
      <label htmlFor={id}>
        {label}
        <select
          id={id}
          value={value}
          disabled={disabled || resource.loading}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{placeholder}</option>
          {resource.items.map((item) => (
            <option
              key={getId(item)}
              value={getId(item)}
              disabled={disabledItem?.(item) ?? false}
            >
              {getLabel(item)}
            </option>
          ))}
        </select>
      </label>
      {resource.loading ? <p className="muted">목록을 불러오고 있습니다.</p> : null}
      {resource.refreshing ? <p className="refreshing">기존 목록을 유지하며 갱신 중입니다.</p> : null}
      {resource.error ? (
        <ErrorState
          title={resource.error.kind === "network" ? "서버에 연결할 수 없습니다" : `${label} 조회 실패`}
          message={resource.error.message}
          retryable={resource.error.retryable}
          onRetry={() => void resource.load(resource.page, resource.items.length > 0)}
        />
      ) : null}
      {!resource.loading && !resource.error && resource.total === 0 ? (
        <p className="empty-inline">선택 가능한 항목이 없습니다.</p>
      ) : null}
      {totalPages > 0 ? (
        <nav className="pagination compact-pagination" aria-label={`${label} 페이지 이동`}>
          <button
            className="button button-secondary"
            type="button"
            disabled={resource.page <= 1 || resource.refreshing}
            onClick={() => void resource.load(resource.page - 1, true)}
          >
            이전
          </button>
          <span>{`전체 ${resource.total}건 · ${resource.page} / ${totalPages} 페이지`}</span>
          <button
            className="button button-secondary"
            type="button"
            disabled={resource.page >= totalPages || resource.refreshing}
            onClick={() => void resource.load(resource.page + 1, true)}
          >
            다음
          </button>
        </nav>
      ) : null}
    </div>
  );
}

export function ExperimentCreateClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState<ApiError | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [datasetId, setDatasetId] = useState("");
  const [datasetVersionId, setDatasetVersionId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [targetVersionId, setTargetVersionId] = useState("");
  const [evaluatorId, setEvaluatorId] = useState("");
  const [evaluatorVersionId, setEvaluatorVersionId] = useState("");
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const projectControllerRef = useRef<AbortController | null>(null);
  const projectRequestIdRef = useRef(0);
  const submitControllerRef = useRef<AbortController | null>(null);

  const datasetLoader = useCallback(
    (page: number, signal: AbortSignal) => listDatasets(projectId, page, signal),
    [projectId],
  );
  const targetLoader = useCallback(
    (page: number, signal: AbortSignal) => listTargets(projectId, page, signal),
    [projectId],
  );
  const evaluatorLoader = useCallback(
    (page: number, signal: AbortSignal) => listEvaluators(projectId, page, signal),
    [projectId],
  );
  const datasetVersionLoader = useCallback(
    (page: number, signal: AbortSignal) => listDatasetVersions(datasetId, page, signal),
    [datasetId],
  );
  const targetVersionLoader = useCallback(
    (page: number, signal: AbortSignal) => listTargetVersions(targetId, page, signal),
    [targetId],
  );
  const evaluatorVersionLoader = useCallback(
    (page: number, signal: AbortSignal) => listEvaluatorVersions(evaluatorId, page, signal),
    [evaluatorId],
  );

  const datasets = usePageResource(true, projectId, datasetLoader);
  const targets = usePageResource(true, projectId, targetLoader);
  const evaluators = usePageResource(true, projectId, evaluatorLoader);
  const datasetVersions = usePageResource(Boolean(datasetId), datasetId, datasetVersionLoader);
  const targetVersions = usePageResource(Boolean(targetId), targetId, targetVersionLoader);
  const evaluatorVersions = usePageResource(Boolean(evaluatorId), evaluatorId, evaluatorVersionLoader);

  const loadProject = useCallback(async () => {
    const requestId = ++projectRequestIdRef.current;
    projectControllerRef.current?.abort();
    const controller = new AbortController();
    projectControllerRef.current = controller;
    setProjectLoading(true);
    setProjectError(null);

    try {
      const result = await getProject(projectId, controller.signal);
      if (requestId !== projectRequestIdRef.current || projectControllerRef.current !== controller) {
        return;
      }
      setProject(result.data);
    } catch (error) {
      if (projectControllerRef.current !== controller) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      setProjectError(toApiError(error));
    } finally {
      if (requestId === projectRequestIdRef.current && projectControllerRef.current === controller) {
        setProjectLoading(false);
        projectControllerRef.current = null;
      }
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
    return () => {
      projectControllerRef.current?.abort();
      submitControllerRef.current?.abort();
    };
  }, [loadProject]);

  function selectDataset(nextId: string) {
    setDatasetId(nextId);
    setDatasetVersionId("");
    setSubmitError(null);
  }

  function selectTarget(nextId: string) {
    setTargetId(nextId);
    setTargetVersionId("");
    setSubmitError(null);
  }

  function selectEvaluator(nextId: string) {
    setEvaluatorId(nextId);
    setEvaluatorVersionId("");
    setSubmitError(null);
  }

  async function createSelectedExperiment() {
    if (
      submitting
      || !project?.isActive
      || !datasetVersionId
      || !targetVersionId
      || !evaluatorVersionId
    ) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    const controller = new AbortController();
    submitControllerRef.current = controller;
    try {
      const result = await createExperiment({
        dataset_version_id: datasetVersionId,
        target_version_id: targetVersionId,
        evaluator_version_id: evaluatorVersionId,
      }, controller.signal);
      router.push(
        `/projects/${encodeURIComponent(projectId)}/experiments/${encodeURIComponent(result.data.id)}`,
      );
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setSubmitError(toApiError(error));
      }
    } finally {
      if (submitControllerRef.current === controller) {
        submitControllerRef.current = null;
        setSubmitting(false);
      }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void createSelectedExperiment();
  }

  const notFound = projectError?.status === 404 || projectError?.code === "PROJECT_NOT_FOUND";
  if (projectLoading && !project && !projectError) {
    return <main className="app-shell"><LoadingState title="Experiment 생성 화면을 준비하고 있습니다" /></main>;
  }
  if (projectError && !project) {
    return (
      <main className="app-shell">
        <ErrorState
          title={projectError.kind === "network" ? "서버에 연결할 수 없습니다" : undefined}
          message={notFound ? "Project를 찾을 수 없습니다." : projectError.message}
          retryable={!notFound && projectError.retryable}
          onRetry={() => void loadProject()}
        />
        <Link className="button button-secondary back-action" href="/projects">
          Projects로 돌아가기
        </Link>
      </main>
    );
  }

  const canSubmit = Boolean(
    project?.isActive
    && datasetVersionId
    && targetVersionId
    && evaluatorVersionId
    && !submitting,
  );

  return (
    <main className="app-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href={`/projects/${encodeURIComponent(projectId)}`}>Project Overview</Link>
        <span aria-hidden="true">/</span>
        <span>New Experiment</span>
      </nav>
      <header className="detail-header">
        <div>
          <p className="eyebrow">Inline Experiment</p>
          <h1>Experiment 생성</h1>
          <p className="page-description">
            같은 Project의 불변 Dataset·Target·Evaluator Version을 선택합니다.
          </p>
        </div>
      </header>

      {!project?.isActive ? (
        <p className="form-error" role="alert">
          비활성 Project에서는 Experiment를 생성할 수 없습니다.
        </p>
      ) : null}

      <form className="experiment-create-form" onSubmit={submit}>
        <section className="detail-panel">
          <div className="section-heading"><h2>1. Dataset Version</h2></div>
          <PaginatedSelector
            id="dataset-parent"
            label="Dataset"
            value={datasetId}
            placeholder="Dataset을 선택하세요"
            resource={datasets}
            getId={(item) => item.id}
            getLabel={(item) => `${item.name}${item.isActive ? "" : " · 비활성"}`}
            disabledItem={(item) => !item.isActive}
            disabled={!project?.isActive || submitting}
            onChange={selectDataset}
          />
          <PaginatedSelector
            id="dataset-version"
            label="Dataset Version"
            value={datasetVersionId}
            placeholder={datasetId ? "Version을 선택하세요" : "먼저 Dataset을 선택하세요"}
            resource={datasetVersions}
            getId={(item) => item.id}
            getLabel={(item) => `Version ${item.version} · ${item.caseCount} cases`}
            disabled={!datasetId || submitting}
            onChange={(value) => setDatasetVersionId(value)}
          />
        </section>

        <section className="detail-panel">
          <div className="section-heading"><h2>2. Target Version</h2></div>
          <PaginatedSelector
            id="target-parent"
            label="Target"
            value={targetId}
            placeholder="Target을 선택하세요"
            resource={targets}
            getId={(item) => item.id}
            getLabel={(item) => `${item.name} · ${item.targetType}${item.isActive ? "" : " · 비활성"}`}
            disabledItem={(item) => !item.isActive}
            disabled={!project?.isActive || submitting}
            onChange={selectTarget}
          />
          <PaginatedSelector
            id="target-version"
            label="Target Version"
            value={targetVersionId}
            placeholder={targetId ? "Version을 선택하세요" : "먼저 Target을 선택하세요"}
            resource={targetVersions}
            getId={(item) => item.id}
            getLabel={(item) => `Version ${item.version} · ${item.responseStrategy}`}
            disabled={!targetId || submitting}
            onChange={(value) => setTargetVersionId(value)}
          />
        </section>

        <section className="detail-panel">
          <div className="section-heading"><h2>3. Evaluator Version</h2></div>
          <PaginatedSelector
            id="evaluator-parent"
            label="Evaluator"
            value={evaluatorId}
            placeholder="Evaluator를 선택하세요"
            resource={evaluators}
            getId={(item) => item.id}
            getLabel={(item) => `${item.name} · ${item.evaluatorType}${item.isActive ? "" : " · 비활성"}`}
            disabledItem={(item) => !item.isActive}
            disabled={!project?.isActive || submitting}
            onChange={selectEvaluator}
          />
          <PaginatedSelector
            id="evaluator-version"
            label="Evaluator Version"
            value={evaluatorVersionId}
            placeholder={evaluatorId ? "Version을 선택하세요" : "먼저 Evaluator를 선택하세요"}
            resource={evaluatorVersions}
            getId={(item) => item.id}
            getLabel={(item) => `Version ${item.version} · ${item.evaluatorTypeSnapshot}`}
            disabled={!evaluatorId || submitting}
            onChange={(value) => setEvaluatorVersionId(value)}
          />
        </section>

        {submitError ? (
          <ErrorState
            title={submitError.kind === "network" ? "서버에 연결할 수 없습니다" : "Experiment를 생성하지 못했습니다"}
            message={submitError.code === "INVALID_RESOURCE_SCOPE"
              ? "선택한 Version이 같은 Project 범위에 속하지 않습니다."
              : submitError.message}
            retryable={submitError.retryable}
            onRetry={() => void createSelectedExperiment()}
          />
        ) : null}

        <div className="form-actions">
          <button className="button" disabled={!canSubmit}>
            {submitting ? "Experiment 생성 중…" : "Experiment 생성"}
          </button>
        </div>
      </form>
    </main>
  );
}
