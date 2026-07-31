import Link from "next/link";

import { PageHeader } from "@/src/components/PageHeader";

export default function NotFound() {
  return (
    <main className="app-shell">
      <PageHeader
        eyebrow="404"
        title="페이지를 찾을 수 없습니다"
        description="요청한 페이지가 없거나 이동되었을 수 있습니다."
        actions={<Link className="button button-secondary" href="/projects">Projects로 돌아가기</Link>}
      />
    </main>
  );
}
