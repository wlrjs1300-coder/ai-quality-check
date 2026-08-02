import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  metadata,
  actions,
  status,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-content">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
        {metadata ? <div className="page-header-metadata">{metadata}</div> : null}
      </div>
      {actions || status ? (
        <div className="page-header-aside">
          {actions ? <div className="header-actions">{actions}</div> : null}
          {status ? <div className="page-header-status">{status}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
