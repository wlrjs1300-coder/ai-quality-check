import { DatasetVersionDetailClient } from "./version-detail-client";

type Props = { params: Promise<{ projectId: string; datasetId: string; version: string }> };

export default async function VersionPage({ params }: Props) {
  const { projectId, datasetId, version } = await params;
  return <DatasetVersionDetailClient projectId={projectId} datasetId={datasetId} versionValue={version} />;
}
