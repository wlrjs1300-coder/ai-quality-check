import { ComparisonDetailClient } from "./comparison-detail-client";

type Props = {
  params: Promise<{ projectId: string; comparisonId: string }>;
};

export default async function ComparisonDetailPage({ params }: Props) {
  const { projectId, comparisonId } = await params;
  return (
    <ComparisonDetailClient
      projectId={projectId}
      comparisonId={comparisonId}
    />
  );
}
