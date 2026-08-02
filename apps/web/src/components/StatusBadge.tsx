type StatusBadgeProps = {
  active: boolean;
};

export function StatusBadge({ active }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${active ? "status-active" : "status-inactive"}`}>
      <span aria-hidden="true">●</span> {active ? "활성" : "비활성"}
    </span>
  );
}
