import { CheckSquare, ChevronDown, ChevronRight, EyeOff, FileText, FolderPlus, Home, Layers, Minus, MoreHorizontal, Paintbrush, Pencil, Plus, RefreshCw, Star, Terminal, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "./ui/sidebar";
import { GRAPH_DIRECTORY_COLOR_OPTIONS, graphDirectoryColorHex } from "../lib/graphColors";
import { useFavorites } from "../lib/useFavorites";
import type { GraphTreeFileData, GraphTreeNodeData, GraphTreeResponse, SurfaceState } from "../types";

type FileTreeNode = {
  data: GraphTreeNodeData;
  children: FileTreeNode[];
};

type DraggedTreeFile = {
  kind: "file";
  file: GraphTreeFileData;
  sourceGraphPath: string;
};

type DraggedGraph = {
  kind: "graph";
  sourceGraphPath: string;
  sourceDisplayName: string;
};

type DraggedItem = DraggedTreeFile | DraggedGraph;

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
  selectedDocumentId: string;
  onSelectGraph: (graphName: string) => void;
  onOpenDocument: (documentId: string, graphPath: string) => void;
  onCreateGraph: (name: string) => void;
  onCreateNode: (graphPath: string, type: "note" | "task" | "command") => void;
  onRenameGraph: (graphPath: string) => void;
  onRenameNode: (documentId: string, fileName: string) => void;
  onMoveNode: (file: GraphTreeFileData, sourceGraphPath: string, targetGraphPath: string) => void;
  onMoveGraph: (sourceGraphPath: string, targetGraphPath: string) => void;
  onDeleteNode: (file: GraphTreeFileData, graphPath: string) => void;
  onDeleteGraph: (graphPath: string) => void;
  onDownloadGraph: (graphPath: string) => void;
  onSetGraphColor: (graphPath: string, color: string | null) => void;
  onSetNodeColor: (documentId: string, color: string | null) => void;
  onSetGraphCanvasDisabled: (graphPath: string, disabled: boolean) => void;
  onRebuildIndex: () => void;
  collapsed: Set<string>;
  onToggleCollapse: (path: string) => void;
  isFavorite: (path: string) => boolean;
  toggleFavorite: (path: string) => void;
  draggedItem: DraggedItem | null;
  dropTargetGraphPath: string;
  onDragStartFile: (file: GraphTreeFileData, sourceGraphPath: string) => void;
  onDragStartGraph: (sourceGraphPath: string, sourceDisplayName: string) => void;
  onDragEndItem: () => void;
  onDropTargetGraphPathChange: (graphPath: string) => void;
  onEnsureExpanded: (graphPath: string) => void;
};

function graphRowStyle(color?: string): CSSProperties | undefined {
  const colorHex = graphDirectoryColorHex(color);
  if (!colorHex) {
    return undefined;
  }

  return { "--graph-row-color": colorHex } as CSSProperties;
}

function FileTreeRow({
  node,
  depth,
  activeSurface,
  selectedDocumentId,
  onSelectGraph,
  onOpenDocument,
  onCreateGraph,
  onCreateNode,
  onRenameGraph,
  onRenameNode,
  onMoveNode,
  onMoveGraph,
  onDeleteNode,
  onDeleteGraph,
  onDownloadGraph,
  onSetGraphColor,
  onSetNodeColor,
  onSetGraphCanvasDisabled,
  onRebuildIndex,
  collapsed,
  onToggleCollapse,
  isFavorite,
  toggleFavorite,
  draggedItem,
  dropTargetGraphPath,
  onDragStartFile,
  onDragStartGraph,
  onDragEndItem,
  onDropTargetGraphPathChange,
  onEnsureExpanded,
}: FileTreeRowProps) {
  const isActive = activeSurface.kind === "graph" && activeSurface.graphPath === node.data.graphPath;
  const canvasDisabled = node.data.canvasDisabled === true;
  const isFav = isFavorite(node.data.graphPath);
  const files = node.data.files ?? [];
  const hasChildren = node.children.length > 0;
  const hasExpandableContent = hasChildren || files.length > 0;
  const isCollapsed = collapsed.has(node.data.graphPath);
  const graphColorStyle = graphRowStyle(node.data.color);
  const isDropTarget = draggedItem !== null
    && dropTargetGraphPath === node.data.graphPath
    && !(draggedItem.kind === "graph"
      ? (draggedItem.sourceGraphPath === node.data.graphPath
        || node.data.graphPath.startsWith(draggedItem.sourceGraphPath + "/"))
      : draggedItem.sourceGraphPath === node.data.graphPath);
  const [addingSubdir, setAddingSubdir] = useState(false);
  const [subdirName, setSubdirName] = useState("");
  const subdirInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingSubdir) {
      subdirInputRef.current?.focus();
    }
  }, [addingSubdir]);

  return (
    <>
      <SidebarMenuSubItem
        className={`graph-tree-row group ${graphColorStyle ? "graph-tree-row-colored" : ""}${isDropTarget ? " graph-tree-row-drop-target" : ""}`}
        style={{ paddingLeft: `${depth * 0.75}rem`, ...graphColorStyle }}
        draggable
        onDragStart={(event) => {
          if (draggedItem !== null) return;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", node.data.graphPath);
          onDragStartGraph(node.data.graphPath, node.data.displayName);
        }}
        onDragEnd={() => {
          onDragEndItem();
        }}
        onDragEnter={(event) => {
          if (draggedItem === null) return;
          const isSelfDrop = draggedItem.kind === "graph"
            ? (draggedItem.sourceGraphPath === node.data.graphPath || node.data.graphPath.startsWith(draggedItem.sourceGraphPath + "/"))
            : draggedItem.sourceGraphPath === node.data.graphPath;
          if (isSelfDrop) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          onDropTargetGraphPathChange(node.data.graphPath);
        }}
        onDragOver={(event) => {
          if (draggedItem === null) return;
          const isSelfDrop = draggedItem.kind === "graph"
            ? (draggedItem.sourceGraphPath === node.data.graphPath || node.data.graphPath.startsWith(draggedItem.sourceGraphPath + "/"))
            : draggedItem.sourceGraphPath === node.data.graphPath;
          if (isSelfDrop) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          onDropTargetGraphPathChange(node.data.graphPath);
        }}
        onDragLeave={(event) => {
          const relatedTarget = event.relatedTarget;
          if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
            return;
          }
          if (dropTargetGraphPath === node.data.graphPath) {
            onDropTargetGraphPathChange("");
          }
        }}
        onDrop={(event) => {
          if (draggedItem === null) return;
          const isSelfDrop = draggedItem.kind === "graph"
            ? (draggedItem.sourceGraphPath === node.data.graphPath || node.data.graphPath.startsWith(draggedItem.sourceGraphPath + "/"))
            : draggedItem.sourceGraphPath === node.data.graphPath;
          if (isSelfDrop) return;
          event.preventDefault();
          event.stopPropagation();
          onEnsureExpanded(node.data.graphPath);
          onDropTargetGraphPathChange("");
          if (draggedItem.kind === "file") {
            onMoveNode(draggedItem.file, draggedItem.sourceGraphPath, node.data.graphPath);
          } else {
            onMoveGraph(draggedItem.sourceGraphPath, node.data.graphPath);
          }
          onDragEndItem();
        }}
      >
        {hasExpandableContent ? (
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
          className={`graph-sub-button${canvasDisabled ? " graph-sub-button-canvas-disabled" : ""}`}
          isActive={isActive && !canvasDisabled}
          onClick={canvasDisabled ? undefined : () => onSelectGraph(node.data.graphPath)}
          type="button"
        >
          <span className="graph-button-labels">
            <strong>{node.data.displayName}</strong>
            <span className="graph-path">{node.data.countLabel}</span>
          </span>
          {canvasDisabled && <EyeOff size={11} className="graph-canvas-disabled-icon" aria-label="Canvas view disabled" />}
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="graph-row-menu-btn"
              aria-label={`More actions for ${node.data.displayName}`}
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right">
            <DropdownMenuItem onClick={() => { onRenameGraph(node.data.graphPath); }}>
              <Pencil size={12} />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Paintbrush size={12} />
                Color
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={node.data.color && node.data.color.trim() !== "" ? node.data.color : "none"}
                  onValueChange={(value) => onSetGraphColor(node.data.graphPath, value === "none" ? null : value)}
                >
                  <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
                  {GRAPH_DIRECTORY_COLOR_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option.id} value={option.id}>
                      <span className="graph-color-swatch" style={{ backgroundColor: option.hex }} aria-hidden="true" />
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { onSetGraphCanvasDisabled(node.data.graphPath, !canvasDisabled); }}>
              <EyeOff size={12} />
              {canvasDisabled ? "Enable canvas view" : "Disable canvas view"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setAddingSubdir(true); }}>
              <FolderPlus size={12} />
              Add subdirectory
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { onCreateNode(node.data.graphPath, "note"); }}>
              <FileText size={12} />
              Add note
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { onCreateNode(node.data.graphPath, "task"); }}>
              <CheckSquare size={12} />
              Add task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { onCreateNode(node.data.graphPath, "command"); }}>
              <Terminal size={12} />
              Add command
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { onDownloadGraph(node.data.graphPath); }}>
              <Layers size={12} />
              Download as zip
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => { onDeleteGraph(node.data.graphPath); }}
            >
              <Trash2 size={12} />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuSubItem>
      {addingSubdir && (
        <li className="graph-add-form" style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}>
          <input
            ref={subdirInputRef}
            className="graph-add-input"
            placeholder={`under ${node.data.displayName}/...`}
            value={subdirName}
            onChange={(e) => setSubdirName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && subdirName.trim() !== "") {
                onCreateGraph(`${node.data.graphPath}/${subdirName.trim()}`);
                setSubdirName("");
                setAddingSubdir(false);
              } else if (e.key === "Escape") {
                setSubdirName("");
                setAddingSubdir(false);
              }
            }}
            aria-label="New subdirectory name"
          />
          <button
            type="button"
            className="graph-add-confirm-btn"
            disabled={subdirName.trim() === ""}
            onClick={() => {
              if (subdirName.trim() !== "") {
                onCreateGraph(`${node.data.graphPath}/${subdirName.trim()}`);
                setSubdirName("");
                setAddingSubdir(false);
              }
            }}
            aria-label="Confirm"
          >
            <Plus size={12} />
          </button>
          <button
            type="button"
            className="graph-add-cancel-btn"
            onClick={() => { setSubdirName(""); setAddingSubdir(false); }}
            aria-label="Cancel"
          >✕</button>
        </li>
      )}
      {!isCollapsed &&
        files.map((file) => (
          <SidebarMenuSubItem
            key={file.id}
            className={`graph-file-row group${draggedItem?.kind === "file" && draggedItem.file.id === file.id ? " graph-file-row-dragging" : ""}`}
            style={{ paddingLeft: `${depth * 0.75 + 1.85}rem` }}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", file.id);
              onDragStartFile(file, node.data.graphPath);
            }}
            onDragEnd={() => {
              onDragEndItem();
            }}
          >
            <SidebarMenuSubButton
              className="graph-file-button"
              isActive={selectedDocumentId === file.id}
              onClick={() => onOpenDocument(file.id, node.data.graphPath)}
              type="button"
            >
              <span className="graph-button-labels">
                <strong>{file.fileName}</strong>
              </span>
            </SidebarMenuSubButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="graph-row-menu-btn"
                  aria-label={`More actions for ${file.fileName}`}
                >
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="right">
                <DropdownMenuItem onClick={() => { onRenameNode(file.id, file.fileName); }}>
                  <Pencil size={12} />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Paintbrush size={12} />
                    Color
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={file.color && file.color.trim() !== "" ? file.color : "none"}
                      onValueChange={(value) => onSetNodeColor(file.id, value === "none" ? null : value)}
                    >
                      <DropdownMenuRadioItem value="none">Graph color</DropdownMenuRadioItem>
                      {GRAPH_DIRECTORY_COLOR_OPTIONS.map((option) => (
                        <DropdownMenuRadioItem key={option.id} value={option.id}>
                          <span className="graph-color-swatch" style={{ backgroundColor: option.hex }} aria-hidden="true" />
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => { onDeleteNode(file, node.data.graphPath); }}
                >
                  <Trash2 size={12} />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuSubItem>
        ))}
      {hasChildren &&
        !isCollapsed &&
        node.children.map((child) => (
          <FileTreeRow
            key={child.data.graphPath}
            node={child}
            depth={depth + 1}
            activeSurface={activeSurface}
            selectedDocumentId={selectedDocumentId}
            onSelectGraph={onSelectGraph}
            onOpenDocument={onOpenDocument}
            onCreateGraph={onCreateGraph}
            onCreateNode={onCreateNode}
            onRenameGraph={onRenameGraph}
            onRenameNode={onRenameNode}
            onMoveNode={onMoveNode}
            onMoveGraph={onMoveGraph}
            onDeleteNode={onDeleteNode}
            onDeleteGraph={onDeleteGraph}
            onDownloadGraph={onDownloadGraph}
            onSetGraphColor={onSetGraphColor}
            onSetNodeColor={onSetNodeColor}
            onSetGraphCanvasDisabled={onSetGraphCanvasDisabled}
            onRebuildIndex={onRebuildIndex}
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            draggedItem={draggedItem}
            dropTargetGraphPath={dropTargetGraphPath}
            onDragStartFile={onDragStartFile}
            onDragStartGraph={onDragStartGraph}
            onDragEndItem={onDragEndItem}
            onDropTargetGraphPathChange={onDropTargetGraphPathChange}
            onEnsureExpanded={onEnsureExpanded}
          />
        ))}
    </>
  );
}

type GraphTreeProps = {
  graphTree: GraphTreeResponse | null;
  activeSurface: SurfaceState;
  selectedDocumentId: string;
  onSelectHome: () => void;
  onSelectGraph: (graphName: string) => void;
  onOpenDocument: (documentId: string, graphPath: string) => void;
  onCreateGraph: (name: string) => void;
  onCreateNode: (graphPath: string, type: "note" | "task" | "command") => void;
  onRenameGraph: (graphPath: string) => void;
  onRenameNode: (documentId: string, fileName: string) => void;
  onMoveNode: (file: GraphTreeFileData, sourceGraphPath: string, targetGraphPath: string) => void;
  onMoveGraph: (sourceGraphPath: string, targetGraphPath: string) => void;
  onDeleteNode: (file: GraphTreeFileData, graphPath: string) => void;
  onDeleteGraph: (graphPath: string) => void;
  onDownloadGraph: (graphPath: string) => void;
  onSetGraphColor: (graphPath: string, color: string | null) => void;
  onSetNodeColor: (documentId: string, color: string | null) => void;
  onSetGraphCanvasDisabled: (graphPath: string, disabled: boolean) => void;
  onRebuildIndex: () => void;
};

export function GraphTree({ graphTree, activeSurface, selectedDocumentId, onSelectHome, onSelectGraph, onOpenDocument, onCreateGraph, onCreateNode, onRenameGraph, onRenameNode, onMoveNode, onMoveGraph, onDeleteNode, onDeleteGraph, onDownloadGraph, onSetGraphColor, onSetNodeColor, onSetGraphCanvasDisabled, onRebuildIndex }: GraphTreeProps) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const [contentExpanded, setContentExpanded] = useState(true);
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [newGraphName, setNewGraphName] = useState("");
  const [addingGraph, setAddingGraph] = useState(false);
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [dropTargetGraphPath, setDropTargetGraphPath] = useState("");
  const [isContentRootDropTarget, setIsContentRootDropTarget] = useState(false);
  const newGraphInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const dragScrollRAFRef = useRef<number>(0);

  useEffect(() => {
    if (addingGraph) {
      newGraphInputRef.current?.focus();
    }
  }, [addingGraph]);

  const allGraphs = graphTree?.graphs ?? [];
  const favoriteGraphs = allGraphs.filter((g) => isFavorite(g.graphPath));
  const fileTree = buildFileTree(allGraphs);

  // Collapse all graphs on initial load so the sidebar starts tidy.
  // Uses a ref to ensure this only runs once, even if allGraphs changes.
  const collapsedInitializedRef = useRef(false);
  useEffect(() => {
    if (collapsedInitializedRef.current) return;
    if (allGraphs.length === 0) return;
    collapsedInitializedRef.current = true;
    setCollapsed(new Set(allGraphs.map((g) => g.graphPath)));
  }, [allGraphs]);

  function handleToggleCollapse(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function ensureExpanded(path: string): void {
    setCollapsed((prev) => {
      if (!prev.has(path)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }

  function handleDragStartFile(file: GraphTreeFileData, sourceGraphPath: string): void {
    setDraggedItem({ kind: "file", file, sourceGraphPath });
  }

  function handleDragStartGraph(sourceGraphPath: string, sourceDisplayName: string): void {
    setDraggedItem({ kind: "graph", sourceGraphPath, sourceDisplayName });
    scrollContainerRef.current = document.querySelector<HTMLElement>('[data-slot="sidebar-content"]');
  }

  function handleDragEndItem(): void {
    setDraggedItem(null);
    setDropTargetGraphPath("");
    setIsContentRootDropTarget(false);
    scrollContainerRef.current = null;
    if (dragScrollRAFRef.current !== 0) {
      cancelAnimationFrame(dragScrollRAFRef.current);
      dragScrollRAFRef.current = 0;
    }
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
                  const graphColorStyle = graphRowStyle(graph.color);
                  return (
                    <SidebarMenuSubItem key={graph.graphPath} className={`graph-tree-row group ${graphColorStyle ? "graph-tree-row-colored" : ""}`} style={graphColorStyle}>
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

        <SidebarMenuItem
          className={`graph-section graph-section-mt${isContentRootDropTarget ? " graph-section-content-drop-target" : ""}`}
          onDragEnter={(event) => {
            if (draggedItem?.kind !== "graph") return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setIsContentRootDropTarget(true);
          }}
          onDragOver={(event) => {
            if (draggedItem?.kind !== "graph") return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            const container = scrollContainerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const y = event.clientY;
            const threshold = 60;
            if (y < rect.top + threshold) {
              const factor = 1 - Math.max(0, (y - rect.top) / threshold);
              container.scrollTop -= Math.max(1, 10 * factor);
            } else if (y > rect.bottom - threshold) {
              const factor = 1 - Math.max(0, (rect.bottom - y) / threshold);
              container.scrollTop += Math.max(1, 10 * factor);
            }
          }}
          onDragLeave={(event) => {
            const relatedTarget = event.relatedTarget;
            if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
              return;
            }
            setIsContentRootDropTarget(false);
          }}
          onDrop={(event) => {
            if (draggedItem?.kind !== "graph") return;
            event.preventDefault();
            setIsContentRootDropTarget(false);
            const targetPath = draggedItem.sourceDisplayName;
            if (targetPath !== draggedItem.sourceGraphPath) {
              onMoveGraph(draggedItem.sourceGraphPath, "");
            }
            handleDragEndItem();
          }}
        >
          <div className="graph-section-header-row">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="graph-add-content-btn"
                  aria-label="Content tree actions"
                  title="Content tree actions"
                >
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" className="min-w-[140px]">
                <DropdownMenuItem onClick={() => { setAddingGraph(true); setContentExpanded(true); }}>
                  <FolderPlus size={12} />
                  Add graph
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { onRebuildIndex(); }}>
                  <RefreshCw size={12} />
                  Refresh index
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {contentExpanded && (
            <SidebarMenuSub className="graph-section-content">
              {fileTree.length > 0 ? (
                fileTree.map((node) => (
                  <FileTreeRow
                    key={node.data.graphPath}
                    node={node}
                    depth={0}
                    activeSurface={activeSurface}
                    selectedDocumentId={selectedDocumentId}
                    onSelectGraph={onSelectGraph}
                    onOpenDocument={onOpenDocument}
                    onCreateGraph={onCreateGraph}
                    onCreateNode={onCreateNode}
                    onRenameGraph={onRenameGraph}
                    onRenameNode={onRenameNode}
                    onMoveNode={onMoveNode}
                    onMoveGraph={onMoveGraph}
                    onDeleteNode={onDeleteNode}
                    onDeleteGraph={onDeleteGraph}
                    onDownloadGraph={onDownloadGraph}
                    onSetGraphColor={onSetGraphColor}
                    onSetNodeColor={onSetNodeColor}
                    onSetGraphCanvasDisabled={onSetGraphCanvasDisabled}
                    onRebuildIndex={onRebuildIndex}
                    collapsed={collapsed}
                    onToggleCollapse={handleToggleCollapse}
                    isFavorite={isFavorite}
                    toggleFavorite={toggleFavorite}
                    draggedItem={draggedItem}
                    dropTargetGraphPath={dropTargetGraphPath}
                    onDragStartFile={handleDragStartFile}
                    onDragStartGraph={handleDragStartGraph}
                    onDragEndItem={handleDragEndItem}
                    onDropTargetGraphPathChange={setDropTargetGraphPath}
                    onEnsureExpanded={ensureExpanded}
                  />
                ))
              ) : (
                <p className="empty-state-inline graph-section-empty">No graphs yet.</p>
              )}
              {addingGraph && (
                <li className="graph-add-form">
                  <input
                    ref={newGraphInputRef}
                    className="graph-add-input"
                    placeholder="e.g. arch or projects/backend"
                    value={newGraphName}
                    onChange={(e) => setNewGraphName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newGraphName.trim() !== "") {
                        onCreateGraph(newGraphName.trim());
                        setNewGraphName("");
                        setAddingGraph(false);
                      } else if (e.key === "Escape") {
                        setNewGraphName("");
                        setAddingGraph(false);
                      }
                    }}
                    aria-label="New graph name"
                  />
                  <button
                    type="button"
                    className="graph-add-confirm-btn"
                    disabled={newGraphName.trim() === ""}
                    onClick={() => {
                      if (newGraphName.trim() !== "") {
                        onCreateGraph(newGraphName.trim());
                        setNewGraphName("");
                        setAddingGraph(false);
                      }
                    }}
                    aria-label="Confirm"
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    type="button"
                    className="graph-add-cancel-btn"
                    onClick={() => { setNewGraphName(""); setAddingGraph(false); }}
                    aria-label="Cancel"
                  >✕</button>
                </li>
              )}
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
