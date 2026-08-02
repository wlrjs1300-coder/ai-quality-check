import { ExperimentCreateClient } from "./experiment-create-client";

type Props = { params: Promise<{ projectId: string }> };

export default async function ExperimentCreatePage({ params }: Props) {
  const { projectId } = await params;
  return <ExperimentCreateClient projectId={projectId} />;
}
