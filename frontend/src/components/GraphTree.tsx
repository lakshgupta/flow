import { CheckSquare, ChevronDown, ChevronRight, FileText, FolderPlus, Home, Layers, Minus, MoreHorizontal, Paintbrush, Pencil, Plus, Star, Terminal, Trash2 } from "lucide-react";
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
  file: GraphTreeFileData;
  sourceGraphPath: string;
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
  selectedDocumentId: string;
  onSelectGraph: (graphName: string) => void;
  onOpenDocument: (documentId: string, graphPath: string) => void;
  onCreateGraph: (name: string) => void;
  onCreateNode: (graphPath: string, type: "note" | "task" | "command") => void;
  onRenameGraph: (graphPath: string) => void;
  onRenameNode: (documentId: string, fileName: string) => void;
  onMoveNode: (file: GraphTreeFileData, sourceGraphPath: string, targetGraphPath: string) => void;
  onDeleteNode: (file: GraphTreeFileData, graphPath: string) => void;
  onDeleteGraph: (graphPath: string) => void;
  onSetGraphColor: (graphPath: string, color: string | null) => void;
  collapsed: Set<string>;
  onToggleCollapse: (path: string) => void;
  isFavorite: (path: string) => boolean;
  toggleFavorite: (path: string) => void;
  draggedFile: DraggedTreeFile | null;
  dropTargetGraphPath: string;
  onDragStartFile: (file: GraphTreeFileData, sourceGraphPath: string) => void;
  onDragEndFile: () => void;
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
  onDeleteNode,
  onDeleteGraph,
  onSetGraphColor,
  collapsed,
  onToggleCollapse,
  isFavorite,
  toggleFavorite,
  draggedFile,
  dropTargetGraphPath,
  onDragStartFile,
  onDragEndFile,
  onDropTargetGraphPathChange,
  onEnsureExpanded,
}: FileTreeRowProps) {
  const isActive = activeSurface.kind === "graph" && activeSurface.graphPath === node.data.graphPath;
  const isFav = isFavorite(node.data.graphPath);
  const files = node.data.files ?? [];
  const hasChildren = node.children.length > 0;
  const hasExpandableContent = hasChildren || files.length > 0;
  const isCollapsed = collapsed.has(node.data.graphPath);
  const graphColorStyle = graphRowStyle(node.data.color);
  const isDropTarget = draggedFile !== null
    && draggedFile.sourceGraphPath !== node.data.graphPath
    && dropTargetGraphPath === node.data.graphPath;
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
        onDragEnter={(event) => {
          if (draggedFile === null || draggedFile.sourceGraphPath === node.data.graphPath) {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          onDropTargetGraphPathChange(node.data.graphPath);
        }}
        onDragOver={(event) => {
          if (draggedFile === null || draggedFile.sourceGraphPath === node.data.graphPath) {
            return;
          }
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
          if (draggedFile === null || draggedFile.sourceGraphPath === node.data.graphPath) {
            return;
          }
          event.preventDefault();
          onEnsureExpanded(node.data.graphPath);
          onDropTargetGraphPathChange("");
          onMoveNode(draggedFile.file, draggedFile.sourceGraphPath, node.data.graphPath);
          onDragEndFile();
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
            className={`graph-file-row group${draggedFile?.file.id === file.id ? " graph-file-row-dragging" : ""}`}
            style={{ paddingLeft: `${depth * 0.75 + 1.85}rem` }}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", file.id);
              onDragStartFile(file, node.data.graphPath);
            }}
            onDragEnd={() => {
              onDragEndFile();
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
            onDeleteNode={onDeleteNode}
            onDeleteGraph={onDeleteGraph}
            onSetGraphColor={onSetGraphColor}
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            draggedFile={draggedFile}
            dropTargetGraphPath={dropTargetGraphPath}
            onDragStartFile={onDragStartFile}
            onDragEndFile={onDragEndFile}
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
  onDeleteNode: (file: GraphTreeFileData, graphPath: string) => void;
  onDeleteGraph: (graphPath: string) => void;
  onSetGraphColor: (graphPath: string, color: string | null) => void;
};

export function GraphTree({ graphTree, activeSurface, selectedDocumentId, onSelectHome, onSelectGraph, onOpenDocument, onCreateGraph, onCreateNode, onRenameGraph, onRenameNode, onMoveNode, onDeleteNode, onDeleteGraph, onSetGraphColor }: GraphTreeProps) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const [contentExpanded, setContentExpanded] = useState(true);
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [newGraphName, setNewGraphName] = useState("");
  const [addingGraph, setAddingGraph] = useState(false);
  const [draggedFile, setDraggedFile] = useState<DraggedTreeFile | null>(null);
  const [dropTargetGraphPath, setDropTargetGraphPath] = useState("");
  const newGraphInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingGraph) {
      newGraphInputRef.current?.focus();
    }
  }, [addingGraph]);

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
    setDraggedFile({ file, sourceGraphPath });
  }

  function handleDragEndFile(): void {
    setDraggedFile(null);
    setDropTargetGraphPath("");
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

        <SidebarMenuItem className="graph-section graph-section-mt">
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
            <button
              type="button"
              className="graph-add-content-btn"
              onClick={() => { setAddingGraph(true); setContentExpanded(true); }}
              aria-label="Add graph or directory"
              title="Add graph or directory"
            >
              <FolderPlus size={14} />
            </button>
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
                    onDeleteNode={onDeleteNode}
                    onDeleteGraph={onDeleteGraph}
                    onSetGraphColor={onSetGraphColor}
                    collapsed={collapsed}
                    onToggleCollapse={handleToggleCollapse}
                    isFavorite={isFavorite}
                    toggleFavorite={toggleFavorite}
                    draggedFile={draggedFile}
                    dropTargetGraphPath={dropTargetGraphPath}
                    onDragStartFile={handleDragStartFile}
                    onDragEndFile={handleDragEndFile}
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
