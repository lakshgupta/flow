import type { ReactNode } from "react";

import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, useSidebar } from "./ui/sidebar";

type AppSidebarProps = {
  topContent?: ReactNode;
  navigationContent: ReactNode;
  footerContent?: ReactNode;
  onResizeMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

export function AppSidebar({
  topContent,
  navigationContent,
  footerContent,
  onResizeMouseDown,
}: AppSidebarProps) {
  const { open } = useSidebar();

  return (
    <Sidebar className="app-left-sidebar">
      <SidebarHeader className="sidebar-header shell-card-header-tight shell-sidebar-header">
        <div className="shell-sidebar-brand-hero">
          {open ? (
            <h2 className="shell-sidebar-brand">Flow</h2>
          ) : (
            <span className="sr-only">Flow</span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="shell-rail-tabs-content">
        {topContent ? (
          <SidebarGroup>
            <SidebarGroupContent>{topContent}</SidebarGroupContent>
          </SidebarGroup>
        ) : null}
        <SidebarGroup>
          {navigationContent}
        </SidebarGroup>
      </SidebarContent>
      {footerContent ? (
        <SidebarFooter className="shell-sidebar-footer">{footerContent}</SidebarFooter>
      ) : null}
      <div
        className="sidebar-resize-handle"
        onMouseDown={onResizeMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
      />
    </Sidebar>
  );
}