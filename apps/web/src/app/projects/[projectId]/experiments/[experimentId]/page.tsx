import { ExperimentDetailClient } from "./experiment-detail-client";

type Props = { params: Promise<{ projectId: string; experimentId: string }> };

export default async function ExperimentDetailPage({ params }: Props) {
  const { projectId, experimentId } = await params;
  return <ExperimentDetailClient projectId={projectId} experimentId={experimentId} />;
}
