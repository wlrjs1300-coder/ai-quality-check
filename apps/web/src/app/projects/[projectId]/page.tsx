import { ProjectDetailClient } from "./project-detail-client";

type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const { projectId } = await params;
  const { from = "", to = "" } = await searchParams;
  return <ProjectDetailClient projectId={projectId} initialFrom={from} initialTo={to} />;
}
