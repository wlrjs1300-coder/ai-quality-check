type DateRangeFilterProps = {
  from: string;
  to: string;
  error: string | null;
  disabled?: boolean;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
};

export function DateRangeFilter({
  from,
  to,
  error,
  disabled = false,
  onFromChange,
  onToChange,
  onApply,
  onReset,
}: DateRangeFilterProps) {
  return (
    <fieldset className="filter-panel">
      <legend>기간 필터</legend>
      <div className="filter-fields">
        <label htmlFor="created-from">
          시작일
          <input
            id="created-from"
            type="date"
            value={from}
            disabled={disabled}
            onChange={(event) => onFromChange(event.target.value)}
          />
        </label>
        <label htmlFor="created-to">
          종료일
          <input
            id="created-to"
            type="date"
            value={to}
            disabled={disabled}
            onChange={(event) => onToChange(event.target.value)}
          />
        </label>
        <div className="filter-actions">
          <button className="button" type="button" disabled={disabled} onClick={onApply}>적용</button>
          <button className="button button-secondary" type="button" disabled={disabled} onClick={onReset}>초기화</button>
        </div>
      </div>
      <p className="field-error" role={error ? "alert" : undefined}>{error ?? ""}</p>
    </fieldset>
  );
}
