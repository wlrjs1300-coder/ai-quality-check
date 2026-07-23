import { ProjectHistoryClient } from "./project-history-client";

type HistoryPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function value(params: Record<string, string | string[] | undefined>, key: string): string {
  const current = params[key];
  return typeof current === "string" ? current : "";
}

export default async function HistoryPage({ params, searchParams }: HistoryPageProps) {
  const { projectId } = await params;
  const query = await searchParams;
  return (
    <ProjectHistoryClient
      projectId={projectId}
      initial={{
        from: value(query, "from"),
        to: value(query, "to"),
        experimentStatus: value(query, "experiment_status"),
        gateStatus: value(query, "gate_status"),
        comparisonStatus: value(query, "comparison_status"),
        sort: value(query, "sort"),
        page: value(query, "page"),
      }}
    />
  );
}
