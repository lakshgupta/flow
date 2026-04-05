import type { HTMLAttributes, ReactNode } from "react";

import { ChevronRight } from "lucide-react";

import { cn } from "../../lib/utils";

export function Breadcrumb({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <nav aria-label="Breadcrumb" className={cn("ds-breadcrumb", className)} {...props} />;
}

export function BreadcrumbList({ className, ...props }: HTMLAttributes<HTMLOListElement>) {
  return <ol className={cn("ds-breadcrumb-list", className)} {...props} />;
}

export function BreadcrumbItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return <li className={cn("ds-breadcrumb-item", className)} {...props} />;
}

export function BreadcrumbPage({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span aria-current="page" className={cn("ds-breadcrumb-page", className)} {...props} />;
}

type BreadcrumbSeparatorProps = {
  children?: ReactNode;
};

export function BreadcrumbSeparator({ children }: BreadcrumbSeparatorProps) {
  return <span className="ds-breadcrumb-separator">{children ?? <ChevronRight size={14} />}</span>;
}