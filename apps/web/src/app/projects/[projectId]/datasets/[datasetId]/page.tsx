import { DatasetDetailClient } from "./dataset-detail-client";

type Props = { params: Promise<{ projectId: string; datasetId: string }> };

export default async function DatasetDetailPage({ params }: Props) {
  const { projectId, datasetId } = await params;
  return <DatasetDetailClient projectId={projectId} datasetId={datasetId} />;
}
