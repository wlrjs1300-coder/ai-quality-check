import Link from "next/link";
import type { ReactNode } from "react";

export type BreadcrumbItem = {
  label: ReactNode;
  href?: string;
};

type BreadcrumbProps = {
  items: readonly BreadcrumbItem[];
  ariaLabel?: string;
};

export function Breadcrumb({
  items,
  ariaLabel = "Breadcrumb",
}: BreadcrumbProps) {
  return (
    <nav className="breadcrumb" aria-label={ariaLabel}>
      <ol className="breadcrumb-list">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          const key = item.href ?? `current-${index}`;

          return (
            <li className="breadcrumb-item" key={key}>
              {index > 0 ? (
                <span className="breadcrumb-separator" aria-hidden="true">/</span>
              ) : null}
              {current ? (
                <span className="breadcrumb-label" aria-current="page">{item.label}</span>
              ) : item.href ? (
                <Link className="breadcrumb-label" href={item.href}>{item.label}</Link>
              ) : (
                <span className="breadcrumb-label">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
