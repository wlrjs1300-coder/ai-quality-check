export type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  ariaLabel: string;
};

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  isLoading = false,
  ariaLabel,
}: PaginationProps) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / Math.max(1, pageSize));

  return (
    <nav className="pagination" aria-label={ariaLabel}>
      <button
        className="button button-secondary"
        type="button"
        disabled={isLoading || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        이전
      </button>
      <span>{`전체 ${total}건 · ${page} / ${totalPages} 페이지`}</span>
      <button
        className="button button-secondary"
        type="button"
        disabled={isLoading || totalPages === 0 || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        다음
      </button>
    </nav>
  );
}
