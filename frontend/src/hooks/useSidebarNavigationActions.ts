import { useCallback, useMemo, useRef } from "react";

import type { GraphTreeFileData } from "../types";

export type SidebarNavigationActions = {
  selectWorkspace: (workspacePath: string) => void;
  selectHome: () => void;
  selectGraph: (graphPath: string) => void;
  openDocument: (documentId: string, graphPath: string) => void;
  createGraph: (name: string) => void;
  createNode: (graphPath: string, type: "note" | "task" | "command") => void;
  renameGraph: (graphPath: string) => void;
  renameNode: (documentId: string, fileName: string) => void;
  moveNode: (file: GraphTreeFileData, sourceGraphPath: string, targetGraphPath: string) => void;
  deleteNode: (file: GraphTreeFileData, graphPath: string) => void;
  deleteGraph: (graphPath: string) => void;
  setGraphColor: (graphPath: string, color: string | null) => void;
};

type UseSidebarNavigationActionsArgs = {
  handleWorkspaceSelection: (workspacePath: string) => Promise<void> | void;
  handleSelectHome: () => Promise<void> | void;
  handleSelectGraph: (graphPath: string) => Promise<void> | void;
  handleSelectDocument: (documentId: string, graphPath: string) => void;
  handleSidebarCreateGraph: (name: string) => Promise<void> | void;
  handleSidebarCreateNode: (graphPath: string, type: "note" | "task" | "command") => void;
  handleSidebarRenameGraph: (graphPath: string) => void;
  handleSidebarRenameNode: (documentId: string, fileName: string) => void;
  handleSidebarMoveNode: (file: GraphTreeFileData, sourceGraphPath: string, targetGraphPath: string) => Promise<void> | void;
  handleSidebarDeleteNode: (file: GraphTreeFileData, graphPath: string) => void;
  handleSidebarDeleteGraph: (graphPath: string) => Promise<void> | void;
  handleSidebarSetGraphColor: (graphPath: string, color: string | null) => Promise<void> | void;
};

export function useSidebarNavigationActions({
  handleWorkspaceSelection,
  handleSelectHome,
  handleSelectGraph,
  handleSelectDocument,
  handleSidebarCreateGraph,
  handleSidebarCreateNode,
  handleSidebarRenameGraph,
  handleSidebarRenameNode,
  handleSidebarMoveNode,
  handleSidebarDeleteNode,
  handleSidebarDeleteGraph,
  handleSidebarSetGraphColor,
}: UseSidebarNavigationActionsArgs): SidebarNavigationActions {
  const actionRefs = useRef<UseSidebarNavigationActionsArgs>({
    handleWorkspaceSelection,
    handleSelectHome,
    handleSelectGraph,
    handleSelectDocument,
    handleSidebarCreateGraph,
    handleSidebarCreateNode,
    handleSidebarRenameGraph,
    handleSidebarRenameNode,
    handleSidebarMoveNode,
    handleSidebarDeleteNode,
    handleSidebarDeleteGraph,
    handleSidebarSetGraphColor,
  });

  actionRefs.current = {
    handleWorkspaceSelection,
    handleSelectHome,
    handleSelectGraph,
    handleSelectDocument,
    handleSidebarCreateGraph,
    handleSidebarCreateNode,
    handleSidebarRenameGraph,
    handleSidebarRenameNode,
    handleSidebarMoveNode,
    handleSidebarDeleteNode,
    handleSidebarDeleteGraph,
    handleSidebarSetGraphColor,
  };

  const selectWorkspace = useCallback((workspacePath: string) => {
    void actionRefs.current.handleWorkspaceSelection(workspacePath);
  }, []);

  const selectHome = useCallback(() => {
    void actionRefs.current.handleSelectHome();
  }, []);

  const selectGraph = useCallback((graphPath: string) => {
    void actionRefs.current.handleSelectGraph(graphPath);
  }, []);

  const openDocument = useCallback((documentId: string, graphPath: string) => {
    actionRefs.current.handleSelectDocument(documentId, graphPath);
  }, []);

  const createGraph = useCallback((name: string) => {
    void actionRefs.current.handleSidebarCreateGraph(name);
  }, []);

  const createNode = useCallback((graphPath: string, type: "note" | "task" | "command") => {
    actionRefs.current.handleSidebarCreateNode(graphPath, type);
  }, []);

  const renameGraph = useCallback((graphPath: string) => {
    actionRefs.current.handleSidebarRenameGraph(graphPath);
  }, []);

  const renameNode = useCallback((documentId: string, fileName: string) => {
    actionRefs.current.handleSidebarRenameNode(documentId, fileName);
  }, []);

  const moveNode = useCallback((file: GraphTreeFileData, sourceGraphPath: string, targetGraphPath: string) => {
    void actionRefs.current.handleSidebarMoveNode(file, sourceGraphPath, targetGraphPath);
  }, []);

  const deleteNode = useCallback((file: GraphTreeFileData, graphPath: string) => {
    actionRefs.current.handleSidebarDeleteNode(file, graphPath);
  }, []);

  const deleteGraph = useCallback((graphPath: string) => {
    void actionRefs.current.handleSidebarDeleteGraph(graphPath);
  }, []);

  const setGraphColor = useCallback((graphPath: string, color: string | null) => {
    void actionRefs.current.handleSidebarSetGraphColor(graphPath, color);
  }, []);

  return useMemo(() => ({
    selectWorkspace,
    selectHome,
    selectGraph,
    openDocument,
    createGraph,
    createNode,
    renameGraph,
    renameNode,
    moveNode,
    deleteNode,
    deleteGraph,
    setGraphColor,
  }), [
    createGraph,
    createNode,
    deleteGraph,
    deleteNode,
    moveNode,
    openDocument,
    renameGraph,
    renameNode,
    selectGraph,
    selectHome,
    selectWorkspace,
    setGraphColor,
  ]);
}