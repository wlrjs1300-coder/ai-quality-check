export function formatRate(value: string | null): string {
  if (value === null) return "데이터 없음";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${(parsed * 100).toFixed(2)}%` : "데이터 없음";
}

export function formatRateDelta(value: string | null): string {
  if (value === null) return "데이터 없음";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed >= 0 ? "+" : ""}${(parsed * 100).toFixed(2)}%p` : "데이터 없음";
}

export function formatLocalDateTime(value: string | null): string {
  if (value === null) return "없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "표시할 수 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}
