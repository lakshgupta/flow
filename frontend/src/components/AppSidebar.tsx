import { GalleryVerticalEnd } from "lucide-react";
import type { ReactNode } from "react";

import { Sidebar, SidebarContent, SidebarGroup, SidebarHeader, useSidebar } from "./ui/sidebar";

type AppSidebarProps = {
  navigationContent: ReactNode;
  onResizeMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

export function AppSidebar({
  navigationContent,
  onResizeMouseDown,
}: AppSidebarProps) {
  const { open } = useSidebar();

  return (
    <Sidebar className="app-left-sidebar">
      <SidebarHeader className="sidebar-header shell-card-header-tight shell-sidebar-header">
        <div className="shell-sidebar-header-row">
          <div className="shell-sidebar-brand-block">
            <div className="shell-sidebar-brand-icon">
              <GalleryVerticalEnd size={16} />
            </div>
            {open ? (
              <div className="shell-sidebar-brand-copy">
                <h2 className="shell-sidebar-brand">Flow</h2>
                <span className="shell-sidebar-brand-meta">Local graph workspace</span>
              </div>
            ) : (
              <span className="sr-only">Flow</span>
            )}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="shell-rail-tabs-content">
        <SidebarGroup>
          {navigationContent}
        </SidebarGroup>
      </SidebarContent>
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