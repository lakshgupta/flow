import { ChevronDown, ChevronRight, Home, Layers, Minus, Plus, Star } from "lucide-react";
import { useState } from "react";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "./ui/sidebar";
import { useFavorites } from "../lib/useFavorites";
import type { GraphTreeNodeData, GraphTreeResponse, SurfaceState } from "../types";

type FileTreeNode = {
  data: GraphTreeNodeData;
  children: FileTreeNode[];
};

function buildFileTree(graphs: GraphTreeNodeData[]): FileTreeNode[] {
  const nodeMap = new Map<string, FileTreeNode>();
  for (const g of graphs) {
    nodeMap.set(g.graphPath, { data: g, children: [] });
  }
  const roots: FileTreeNode[] = [];
  for (const g of graphs) {
    const parts = g.graphPath.split("/");
    if (parts.length === 1) {
      roots.push(nodeMap.get(g.graphPath)!);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      const parent = nodeMap.get(parentPath);
      if (parent) {
        parent.children.push(nodeMap.get(g.graphPath)!);
      } else {
        roots.push(nodeMap.get(g.graphPath)!);
      }
    }
  }
  return roots;
}

type FileTreeRowProps = {
  node: FileTreeNode;
  depth: number;
  activeSurface: SurfaceState;
  onSelectGraph: (graphName: string) => void;
  collapsed: Set<string>;
  onToggleCollapse: (path: string) => void;
  isFavorite: (path: string) => boolean;
  toggleFavorite: (path: string) => void;
};

function FileTreeRow({
  node,
  depth,
  activeSurface,
  onSelectGraph,
  collapsed,
  onToggleCollapse,
  isFavorite,
  toggleFavorite,
}: FileTreeRowProps) {
  const isActive = activeSurface.kind === "graph" && activeSurface.graphPath === node.data.graphPath;
  const isFav = isFavorite(node.data.graphPath);
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.data.graphPath);

  return (
    <>
      <SidebarMenuSubItem className="graph-tree-row group" style={{ paddingLeft: `${depth * 0.75}rem` }}>
        {hasChildren ? (
          <button
            type="button"
            className="graph-tree-chevron"
            onClick={() => onToggleCollapse(node.data.graphPath)}
            aria-label={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : (
          <span className="graph-tree-chevron-spacer" />
        )}
        <SidebarMenuSubButton
          className="graph-sub-button"
          isActive={isActive}
          onClick={() => onSelectGraph(node.data.graphPath)}
          type="button"
        >
          <span className="graph-button-labels">
            <strong>{node.data.displayName}</strong>
            <span className="graph-path">{node.data.countLabel}</span>
          </span>
        </SidebarMenuSubButton>
        <button
          type="button"
          className={`graph-fav-toggle ${isFav ? "graph-fav-toggle-active" : ""}`}
          onClick={() => toggleFavorite(node.data.graphPath)}
          aria-label={
            isFav
              ? `Remove ${node.data.displayName} from favorites`
              : `Add ${node.data.displayName} to favorites`
          }
        >
          <Star size={14} className={isFav ? "fill-amber-500 text-amber-500" : ""} />
        </button>
      </SidebarMenuSubItem>
      {hasChildren &&
        !isCollapsed &&
        node.children.map((child) => (
          <FileTreeRow
            key={child.data.graphPath}
            node={child}
            depth={depth + 1}
            activeSurface={activeSurface}
            onSelectGraph={onSelectGraph}
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
          />
        ))}
    </>
  );
}

type GraphTreeProps = {
  graphTree: GraphTreeResponse | null;
  activeSurface: SurfaceState;
  onSelectHome: () => void;
  onSelectGraph: (graphName: string) => void;
};

export function GraphTree({ graphTree, activeSurface, onSelectHome, onSelectGraph }: GraphTreeProps) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const [contentExpanded, setContentExpanded] = useState(true);
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const allGraphs = graphTree?.graphs ?? [];
  const favoriteGraphs = allGraphs.filter((g) => isFavorite(g.graphPath));
  const fileTree = buildFileTree(allGraphs);

  function handleToggleCollapse(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <SidebarGroup className="graph-navigation">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            className="graph-button graph-button-home"
            isActive={activeSurface.kind === "home"}
            onClick={onSelectHome}
            type="button"
          >
            <Home size={16} />
            <span className="graph-button-labels">
              <strong>{graphTree?.home.title ?? "Home"}</strong>
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem className="graph-section graph-section-mt">
          <SidebarMenuButton
            className="graph-section-header"
            onClick={() => setFavoritesExpanded((e) => !e)}
            type="button"
          >
            <Star size={16} />
            <span className="graph-section-title">Favorites</span>
            {favoriteGraphs.length > 0 && (
              <span className="graph-section-count">{favoriteGraphs.length}</span>
            )}
            {favoritesExpanded ? (
              <Minus className="graph-section-toggle-icon" size={14} />
            ) : (
              <Plus className="graph-section-toggle-icon" size={14} />
            )}
          </SidebarMenuButton>
          {favoritesExpanded && (
            <SidebarMenuSub className="graph-section-content">
              {favoriteGraphs.length > 0 ? (
                favoriteGraphs.map((graph) => {
                  const isActive =
                    activeSurface.kind === "graph" && activeSurface.graphPath === graph.graphPath;
                  const isFav = isFavorite(graph.graphPath);
                  return (
                    <SidebarMenuSubItem key={graph.graphPath} className="graph-tree-row group">
                      <SidebarMenuSubButton
                        className="graph-sub-button"
                        isActive={isActive}
                        onClick={() => onSelectGraph(graph.graphPath)}
                        type="button"
                      >
                        <span className="graph-button-labels">
                          <strong>{graph.displayName}</strong>
                          <span className="graph-path">{graph.countLabel}</span>
                        </span>
                      </SidebarMenuSubButton>
                      <button
                        type="button"
                        className={`graph-fav-toggle ${isFav ? "graph-fav-toggle-active" : ""}`}
                        onClick={() => toggleFavorite(graph.graphPath)}
                        aria-label={
                          isFav
                            ? `Remove ${graph.displayName} from favorites`
                            : `Add ${graph.displayName} to favorites`
                        }
                      >
                        <Star size={14} className={isFav ? "fill-amber-500 text-amber-500" : ""} />
                      </button>
                    </SidebarMenuSubItem>
                  );
                })
              ) : (
                <p className="empty-state-inline graph-section-empty">Star a graph below to pin it here.</p>
              )}
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>

        <SidebarMenuItem className="graph-section graph-section-mt">
          <SidebarMenuButton
            className="graph-section-header"
            onClick={() => setContentExpanded((e) => !e)}
            type="button"
          >
            <Layers size={16} />
            <span className="graph-section-title">Content</span>
            {allGraphs.length > 0 && <span className="graph-section-count">{allGraphs.length}</span>}
            {contentExpanded ? (
              <Minus className="graph-section-toggle-icon" size={14} />
            ) : (
              <Plus className="graph-section-toggle-icon" size={14} />
            )}
          </SidebarMenuButton>
          {contentExpanded && (
            <SidebarMenuSub className="graph-section-content">
              {fileTree.length > 0 ? (
                fileTree.map((node) => (
                  <FileTreeRow
                    key={node.data.graphPath}
                    node={node}
                    depth={0}
                    activeSurface={activeSurface}
                    onSelectGraph={onSelectGraph}
                    collapsed={collapsed}
                    onToggleCollapse={handleToggleCollapse}
                    isFavorite={isFavorite}
                    toggleFavorite={toggleFavorite}
                  />
                ))
              ) : (
                <p className="empty-state-inline graph-section-empty">No graphs yet.</p>
              )}
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
