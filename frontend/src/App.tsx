import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
} from "@xyflow/react";
import MarkdownIt from "markdown-it";
import { startTransition, useDeferredValue, useEffect, useState } from "react";

import "./styles.css";

type WorkspaceResponse = {
  scope: string;
  workspacePath: string;
  flowPath: string;
  configPath: string;
  indexPath: string;
  guiPort: number;
};

type GraphItem = {
  id: string;
  title: string;
  path: string;
};

type GraphListResponse = {
  type: string;
  availableGraphs: string[];
  graphItems: Record<string, GraphItem[]>;
};

type TaskNodeData = {
  id: string;
  featureSlug: string;
  graph: string;
  title: string;
  status: string;
  path: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  dependsOn?: string[];
  references?: string[];
  layer: number;
};

type TaskLayerView = {
  layers: Array<{ index: number; tasks: TaskNodeData[] }>;
  tasks: Record<string, TaskNodeData>;
};

type CommandNodeData = {
  id: string;
  featureSlug: string;
  graph: string;
  title: string;
  path: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  dependsOn?: string[];
  references?: string[];
  name: string;
  run: string;
  env?: Record<string, string>;
  layer: number;
};

type CommandLayerView = {
  selectedGraph: string;
  availableGraphs: string[];
  graphCommands: Record<string, string[]>;
  layers: Array<{ index: number; commands: CommandNodeData[] }>;
  commands: Record<string, CommandNodeData>;
};

type NoteNodeData = {
  id: string;
  featureSlug: string;
  graph: string;
  title: string;
  path: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  references?: string[];
  relatedNoteIDs?: string[];
};

type NoteGraphView = {
  availableGraphs: string[];
  graphNotes: Record<string, string[]>;
  nodes: Record<string, NoteNodeData>;
  edges: Array<{ leftNoteID: string; rightNoteID: string }>;
};

type DocumentResponse = {
  id: string;
  type: string;
  featureSlug: string;
  graph: string;
  title: string;
  path: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  body: string;
  status?: string;
  dependsOn?: string[];
  references?: string[];
  name?: string;
  env?: Record<string, string>;
  run?: string;
  relatedNoteIds?: string[];
};

type SearchResult = {
  id: string;
  type: string;
  featureSlug: string;
  graph: string;
  title: string;
  path: string;
  snippet: string;
};

type DocumentFormState = {
  title: string;
  graph: string;
  tags: string;
  body: string;
  status: string;
  dependsOn: string;
  references: string;
  name: string;
  env: string;
  run: string;
};

type DeleteDocumentResponse = {
  deleted: boolean;
  id: string;
  path: string;
};

type WorkspaceSnapshot = {
  workspaceData: WorkspaceResponse;
  noteGraphLists: GraphListResponse;
  taskGraphLists: GraphListResponse;
  commandGraphLists: GraphListResponse;
  taskLayerData: TaskLayerView;
  noteGraphData: NoteGraphView;
  commandLayerData: CommandLayerView;
  nextCommandGraph: string;
};

const markdown = new MarkdownIt({ linkify: true, breaks: true });

const emptyDocumentFormState: DocumentFormState = {
  title: "",
  graph: "",
  tags: "",
  body: "",
  status: "",
  dependsOn: "",
  references: "",
  name: "",
  env: "",
  run: "",
};

const emptyCommandLayerView: CommandLayerView = {
  selectedGraph: "",
  availableGraphs: [],
  graphCommands: {},
  layers: [],
  commands: {},
};

async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

function formatDocumentType(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatGraphTitle(value: string): string {
  return value.replace(/[-_]/g, " ");
}

function fileNameFromPath(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function joinList(values?: string[]): string {
  return (values ?? []).join("\n");
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function serializeEnv(env?: Record<string, string>): string {
  return Object.entries(env ?? {})
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function parseEnv(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of value.split("\n")) {
    const line = rawLine.trim();
    if (line === "") {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      throw new Error(`Environment entries must use KEY=VALUE format: ${line}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const envValue = line.slice(separatorIndex + 1);
    if (key === "") {
      throw new Error(`Environment entries must use KEY=VALUE format: ${line}`);
    }

    result[key] = envValue;
  }

  return result;
}

function createDocumentFormState(document: DocumentResponse | null): DocumentFormState {
  if (document === null) {
    return emptyDocumentFormState;
  }

  return {
    title: document.title,
    graph: document.graph,
    tags: joinList(document.tags),
    body: document.body,
    status: document.status ?? "",
    dependsOn: joinList(document.dependsOn),
    references: joinList(document.references),
    name: document.name ?? "",
    env: serializeEnv(document.env),
    run: document.run ?? "",
  };
}

async function loadWorkspaceSnapshot(preferredCommandGraph: string): Promise<WorkspaceSnapshot> {
  const [workspaceData, noteGraphLists, taskGraphLists, commandGraphLists, taskLayerData, noteGraphData] = await Promise.all([
    requestJSON<WorkspaceResponse>("/api/workspace"),
    requestJSON<GraphListResponse>("/api/graphs/note"),
    requestJSON<GraphListResponse>("/api/graphs/task"),
    requestJSON<GraphListResponse>("/api/graphs/command"),
    requestJSON<TaskLayerView>("/api/layers/tasks"),
    requestJSON<NoteGraphView>("/api/notes/graph"),
  ]);

  const nextCommandGraph = commandGraphLists.availableGraphs.includes(preferredCommandGraph)
    ? preferredCommandGraph
    : (commandGraphLists.availableGraphs[0] ?? "");

  const commandLayerData = nextCommandGraph === ""
    ? { ...emptyCommandLayerView, availableGraphs: commandGraphLists.availableGraphs }
    : await requestJSON<CommandLayerView>(`/api/layers/commands?graph=${encodeURIComponent(nextCommandGraph)}`);

  return {
    workspaceData,
    noteGraphLists,
    taskGraphLists,
    commandGraphLists,
    taskLayerData,
    noteGraphData,
    commandLayerData,
    nextCommandGraph,
  };
}

function FlowApp() {
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [noteGraphs, setNoteGraphs] = useState<GraphListResponse | null>(null);
  const [taskGraphs, setTaskGraphs] = useState<GraphListResponse | null>(null);
  const [commandGraphs, setCommandGraphs] = useState<GraphListResponse | null>(null);
  const [taskLayers, setTaskLayers] = useState<TaskLayerView | null>(null);
  const [commandLayers, setCommandLayers] = useState<CommandLayerView | null>(null);
  const [noteGraph, setNoteGraph] = useState<NoteGraphView | null>(null);
  const [selectedCommandGraph, setSelectedCommandGraph] = useState<string>("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [selectedDocument, setSelectedDocument] = useState<DocumentResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [searchError, setSearchError] = useState<string>("");
  const [panelError, setPanelError] = useState<string>("");
  const [stoppingGUI, setStoppingGUI] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [formState, setFormState] = useState<DocumentFormState>(emptyDocumentFormState);
  const [mutationError, setMutationError] = useState<string>("");
  const [mutationSuccess, setMutationSuccess] = useState<string>("");
  const [savingDocument, setSavingDocument] = useState<boolean>(false);
  const [deletingDocument, setDeletingDocument] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function loadShell(): Promise<void> {
      try {
        setLoading(true);
        setError("");

        const snapshot = await loadWorkspaceSnapshot("");
        if (cancelled) {
          return;
        }

        setWorkspace(snapshot.workspaceData);
        setNoteGraphs(snapshot.noteGraphLists);
        setTaskGraphs(snapshot.taskGraphLists);
        setCommandGraphs(snapshot.commandGraphLists);
        setTaskLayers(snapshot.taskLayerData);
        setNoteGraph(snapshot.noteGraphData);
        setCommandLayers(snapshot.commandLayerData);

        if (snapshot.nextCommandGraph !== "") {
          startTransition(() => {
            setSelectedCommandGraph(snapshot.nextCommandGraph);
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadShell();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedCommandGraph === "") {
      return;
    }

    let cancelled = false;

    async function loadCommandLayers(): Promise<void> {
      try {
        const response = await requestJSON<CommandLayerView>(`/api/layers/commands?graph=${encodeURIComponent(selectedCommandGraph)}`);
        if (!cancelled) {
          setCommandLayers(response);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    }

    void loadCommandLayers();

    return () => {
      cancelled = true;
    };
  }, [selectedCommandGraph]);

  useEffect(() => {
    if (selectedDocumentId === "") {
      setSelectedDocument(null);
      setFormState(emptyDocumentFormState);
      setIsEditing(false);
      setPanelError("");
      return;
    }

    let cancelled = false;

    async function loadDocument(): Promise<void> {
      try {
        setPanelError("");
        const response = await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(selectedDocumentId)}`);
        if (!cancelled) {
          setSelectedDocument(response);
          setFormState(createDocumentFormState(response));
          setIsEditing(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setSelectedDocument(null);
          setFormState(emptyDocumentFormState);
          setIsEditing(false);
          setPanelError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    }

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [selectedDocumentId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSearch(): Promise<void> {
      if (deferredSearchQuery === "") {
        setSearchResults([]);
        setSearchError("");
        return;
      }

      try {
        setSearchError("");
        const response = await requestJSON<SearchResult[]>(`/api/search?q=${encodeURIComponent(deferredSearchQuery)}&limit=8`);
        if (!cancelled) {
          setSearchResults(response);
        }
      } catch (loadError) {
        if (!cancelled) {
          setSearchResults([]);
          setSearchError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    }

    void loadSearch();

    return () => {
      cancelled = true;
    };
  }, [deferredSearchQuery]);

  const noteCanvasNodes: Node[] = [];
  const noteCanvasEdges: Edge[] = [];

  if (noteGraph !== null) {
    const noteIds = Object.keys(noteGraph.nodes);
    const radius = 190;
    noteIds.forEach((noteId, index) => {
      const angle = (index / Math.max(noteIds.length, 1)) * Math.PI * 2;
      const note = noteGraph.nodes[noteId];
      noteCanvasNodes.push({
        id: noteId,
        position: {
          x: Math.cos(angle) * radius + 240,
          y: Math.sin(angle) * radius + 190,
        },
        data: {
          label: `${note.title}\n${note.graph}`,
        },
        style: {
          width: 168,
          borderRadius: 22,
          border: selectedDocumentId === noteId ? "2px solid #a7392b" : "1px solid rgba(26, 44, 43, 0.14)",
          background: note.graph === "notes" ? "#fff7ef" : "#f5f1e7",
          color: "#173230",
          boxShadow: "0 16px 30px rgba(31, 48, 36, 0.12)",
          padding: "10px 12px",
          fontSize: "12px",
          lineHeight: 1.35,
          whiteSpace: "pre-line",
        },
      });
    });

    noteGraph.edges.forEach((edge) => {
      noteCanvasEdges.push({
        id: `${edge.leftNoteID}-${edge.rightNoteID}`,
        source: edge.leftNoteID,
        target: edge.rightNoteID,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#4e6863", strokeWidth: 2 },
      });
    });
  }

  async function refreshShellViews(options?: { nextDocument?: DocumentResponse | null; nextDocumentId?: string }): Promise<void> {
    const snapshot = await loadWorkspaceSnapshot(selectedCommandGraph);
    setWorkspace(snapshot.workspaceData);
    setNoteGraphs(snapshot.noteGraphLists);
    setTaskGraphs(snapshot.taskGraphLists);
    setCommandGraphs(snapshot.commandGraphLists);
    setTaskLayers(snapshot.taskLayerData);
    setNoteGraph(snapshot.noteGraphData);
    setCommandLayers(snapshot.commandLayerData);
    if (snapshot.nextCommandGraph !== selectedCommandGraph) {
      startTransition(() => {
        setSelectedCommandGraph(snapshot.nextCommandGraph);
      });
    }

    if (options && "nextDocument" in options) {
      setSelectedDocument(options.nextDocument ?? null);
      setFormState(createDocumentFormState(options.nextDocument ?? null));
      setSelectedDocumentId(options.nextDocumentId ?? "");
    }

    if (deferredSearchQuery !== "") {
      const response = await requestJSON<SearchResult[]>(`/api/search?q=${encodeURIComponent(deferredSearchQuery)}&limit=8`);
      setSearchResults(response);
      setSearchError("");
    }
  }

  function updateFormField(field: keyof DocumentFormState, value: string): void {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  async function handleStopGUI(): Promise<void> {
    try {
      setStoppingGUI(true);
      await requestJSON<{ stopping: boolean }>("/api/gui/stop", { method: "POST" });
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : String(stopError));
    } finally {
      setStoppingGUI(false);
    }
  }

  async function handleSaveDocument(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (selectedDocument === null) {
      return;
    }

    try {
      setSavingDocument(true);
      setMutationError("");
      setMutationSuccess("");

      const payload: Record<string, unknown> = {
        title: formState.title,
        graph: formState.graph,
        tags: splitList(formState.tags),
        body: formState.body,
        references: splitList(formState.references),
      };

      if (selectedDocument.type === "task") {
        payload.status = formState.status;
        payload.dependsOn = splitList(formState.dependsOn);
      }

      if (selectedDocument.type === "command") {
        payload.name = formState.name;
        payload.run = formState.run;
        payload.dependsOn = splitList(formState.dependsOn);
        payload.env = parseEnv(formState.env);
      }

      const updatedDocument = await requestJSON<DocumentResponse>(`/api/documents/${encodeURIComponent(selectedDocument.id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      await refreshShellViews({ nextDocument: updatedDocument, nextDocumentId: updatedDocument.id });
      setSelectedDocument(updatedDocument);
      setFormState(createDocumentFormState(updatedDocument));
      setIsEditing(false);
      setMutationSuccess(`${formatDocumentType(updatedDocument.type)} updated.`);
    } catch (mutationFailure) {
      setMutationError(mutationFailure instanceof Error ? mutationFailure.message : String(mutationFailure));
    } finally {
      setSavingDocument(false);
    }
  }

  async function handleDeleteDocument(): Promise<void> {
    if (selectedDocument === null) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedDocument.title || selectedDocument.id}? This removes the Markdown file and refreshes workspace state.`);
    if (!confirmed) {
      return;
    }

    try {
      setDeletingDocument(true);
      setMutationError("");
      setMutationSuccess("");

      const response = await requestJSON<DeleteDocumentResponse>(`/api/documents/${encodeURIComponent(selectedDocument.id)}`, {
        method: "DELETE",
      });

      await refreshShellViews({ nextDocument: null, nextDocumentId: "" });
      setIsEditing(false);
      setMutationSuccess(`${formatDocumentType(selectedDocument.type)} deleted from ${response.path}.`);
    } catch (mutationFailure) {
      setMutationError(mutationFailure instanceof Error ? mutationFailure.message : String(mutationFailure));
    } finally {
      setDeletingDocument(false);
    }
  }

  if (loading) {
    return (
      <main className="app-shell app-shell-loading">
        <section className="loading-card">
          <p className="eyebrow">Flow GUI</p>
          <h1>Loading workspace state</h1>
          <p>Fetching grouped graphs, layers, notes canvas data, and document state.</p>
        </section>
      </main>
    );
  }

  if (error !== "" && workspace === null) {
    return (
      <main className="app-shell app-shell-loading">
        <section className="loading-card loading-card-error">
          <p className="eyebrow">Flow GUI</p>
          <h1>Workspace load failed</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="app-grid">
        <aside className="sidebar-shell">
          <div className="brand-block">
            <p className="eyebrow">Browser Editing Milestone</p>
            <h1>Flow</h1>
            <p className="workspace-copy">
              {workspace?.scope} workspace on port {workspace?.guiPort}
            </p>
          </div>

          <section className="sidebar-card">
            <header className="sidebar-header">
              <h2>Workspace</h2>
            </header>
            <dl className="workspace-meta">
              <div>
                <dt>Root</dt>
                <dd>{workspace?.workspacePath}</dd>
              </div>
              <div>
                <dt>Index</dt>
                <dd>{workspace?.indexPath}</dd>
              </div>
              <div>
                <dt>Config</dt>
                <dd>{workspace?.configPath}</dd>
              </div>
            </dl>
            <button className="danger-button" onClick={() => void handleStopGUI()} disabled={stoppingGUI}>
              {stoppingGUI ? "Stopping GUI..." : "Stop GUI"}
            </button>
          </section>

          <section className="sidebar-card">
            <header className="sidebar-header">
              <h2>Graphs</h2>
            </header>
            <GraphGroup label="Notes" graphs={noteGraphs} selectedGraph="" onSelectGraph={() => {}} interactive={false} />
            <GraphGroup label="Tasks" graphs={taskGraphs} selectedGraph="" onSelectGraph={() => {}} interactive={false} />
            <GraphGroup
              label="Commands"
              graphs={commandGraphs}
              selectedGraph={selectedCommandGraph}
              onSelectGraph={(graphName) => {
                startTransition(() => {
                  setSelectedCommandGraph(graphName);
                });
              }}
              interactive
            />
          </section>

          <section className="sidebar-card">
            <header className="sidebar-header">
              <h2>Search</h2>
            </header>
            <label className="search-field">
              <span>Search indexed content</span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search notes, tasks, commands"
              />
            </label>
            {searchError !== "" ? <p className="status-line status-line-error">{searchError}</p> : null}
            <div className="search-results">
              {searchResults.length === 0 && deferredSearchQuery !== "" ? <p className="empty-state-inline">No indexed matches.</p> : null}
              {searchResults.map((result) => (
                <button key={result.id} className="search-result" onClick={() => setSelectedDocumentId(result.id)}>
                  <span className="search-result-type">{formatDocumentType(result.type)}</span>
                  <strong>{result.title}</strong>
                  <span className="item-file-name">{fileNameFromPath(result.path)}</span>
                  <span>{result.graph}</span>
                  <span className="item-path">{result.path}</span>
                  <p>{result.snippet}</p>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="content-shell">
          {error !== "" ? <p className="status-line status-line-error">{error}</p> : null}

          <section className="hero-panel">
            <div>
              <p className="eyebrow">Workspace Overview</p>
              <h2>Inspect, update, and remove Markdown-backed documents without leaving the graph view</h2>
            </div>
            <div className="hero-pill-row">
              <span>{noteGraphs?.availableGraphs.length ?? 0} note graphs</span>
              <span>{taskLayers?.layers.length ?? 0} task layers</span>
              <span>{commandLayers?.layers.length ?? 0} command layers</span>
            </div>
          </section>

          <section className="panel-grid panel-grid-top">
            <section className="panel-card panel-card-wide">
              <header className="panel-header">
                <div>
                  <p className="section-kicker">Notes Canvas</p>
                  <h3>Bidirectional note relationships</h3>
                </div>
                <span className="meta-chip">Select a note to edit or remove it</span>
              </header>
              <div className="canvas-shell">
                <ReactFlow
                  fitView
                  nodes={noteCanvasNodes}
                  edges={noteCanvasEdges}
                  onNodeClick={(_, node) => setSelectedDocumentId(node.id)}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable
                  fitViewOptions={{ padding: 0.22 }}
                >
                  <MiniMap pannable zoomable nodeStrokeWidth={3} />
                  <Controls showInteractive={false} />
                  <Background gap={28} color="#d7d0bf" />
                </ReactFlow>
              </div>
            </section>

            <section className="panel-card panel-card-narrow">
              <header className="panel-header">
                <div>
                  <p className="section-kicker">Task Layers</p>
                  <h3>Dependency-ordered tasks</h3>
                </div>
              </header>
              <div className="layer-list">
                {taskLayers?.layers.map((layer) => (
                  <div key={layer.index} className="layer-card">
                    <div className="layer-title">Layer {layer.index}</div>
                    {layer.tasks.map((task) => (
                      <button key={task.id} className="layer-item" onClick={() => setSelectedDocumentId(task.id)}>
                        <strong>{task.title}</strong>
                        <span className="item-file-name">{fileNameFromPath(task.path)}</span>
                        <span>{task.graph}</span>
                        <small className="item-path">{task.path}</small>
                        <small>{task.status || "todo"}</small>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </section>

          <section className="panel-card">
            <header className="panel-header">
              <div>
                <p className="section-kicker">Command Layers</p>
                <h3>{selectedCommandGraph === "" ? "No command graph selected" : `Graph: ${formatGraphTitle(selectedCommandGraph)}`}</h3>
              </div>
              <span className="meta-chip">Select a command to update or delete it</span>
            </header>
            <div className="command-grid">
              {commandLayers?.layers.map((layer) => (
                <div key={layer.index} className="command-column">
                  <div className="layer-title">Layer {layer.index}</div>
                  {layer.commands.map((command) => (
                    <button key={command.id} className="command-card" onClick={() => setSelectedDocumentId(command.id)}>
                      <strong>{command.title}</strong>
                      <span className="item-file-name">{fileNameFromPath(command.path)}</span>
                      <span>{command.name}</span>
                      <span className="item-path">{command.path}</span>
                      <code>{command.run}</code>
                    </button>
                  ))}
                </div>
              ))}
              {commandLayers !== null && commandLayers.layers.length === 0 ? <p className="empty-state-inline">No command layers available.</p> : null}
            </div>
          </section>
        </section>

        <aside className="detail-shell">
          <section className="detail-card">
            <header className="panel-header">
              <div>
                <p className="section-kicker">Inspector</p>
                <h3>{selectedDocument?.title ?? "Document panel"}</h3>
              </div>
              <div className="detail-actions">
                {selectedDocument !== null ? <span className="meta-chip">{formatDocumentType(selectedDocument.type)}</span> : null}
                {selectedDocument !== null && !isEditing ? (
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setMutationError("");
                      setMutationSuccess("");
                      setIsEditing(true);
                    }}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            </header>

            {panelError !== "" ? <p className="status-line status-line-error">{panelError}</p> : null}
            {mutationError !== "" ? <p className="status-line status-line-error">{mutationError}</p> : null}
            {mutationSuccess !== "" ? <p className="status-line status-line-success">{mutationSuccess}</p> : null}

            {selectedDocument === null ? (
              <div className="detail-empty">
                <p>Select a note, task, command, or search result to inspect or mutate its canonical Markdown-backed state.</p>
              </div>
            ) : isEditing ? (
              <form className="editor-form" onSubmit={(event) => void handleSaveDocument(event)}>
                <label className="editor-field">
                  <span>Title</span>
                  <input value={formState.title} onChange={(event) => updateFormField("title", event.target.value)} />
                </label>

                <label className="editor-field">
                  <span>Graph</span>
                  <input value={formState.graph} onChange={(event) => updateFormField("graph", event.target.value)} />
                </label>

                <label className="editor-field">
                  <span>Tags</span>
                  <textarea
                    rows={2}
                    value={formState.tags}
                    onChange={(event) => updateFormField("tags", event.target.value)}
                    placeholder="One tag per line or comma-separated"
                  />
                </label>

                {selectedDocument.type === "task" ? (
                  <label className="editor-field">
                    <span>Status</span>
                    <input value={formState.status} onChange={(event) => updateFormField("status", event.target.value)} />
                  </label>
                ) : null}

                {(selectedDocument.type === "task" || selectedDocument.type === "command") ? (
                  <label className="editor-field">
                    <span>Dependencies</span>
                    <textarea
                      rows={3}
                      value={formState.dependsOn}
                      onChange={(event) => updateFormField("dependsOn", event.target.value)}
                      placeholder="One dependency ID per line or comma-separated"
                    />
                  </label>
                ) : null}

                <label className="editor-field">
                  <span>References</span>
                  <textarea
                    rows={3}
                    value={formState.references}
                    onChange={(event) => updateFormField("references", event.target.value)}
                    placeholder="One reference ID per line or comma-separated"
                  />
                </label>

                {selectedDocument.type === "command" ? (
                  <>
                    <label className="editor-field">
                      <span>Name</span>
                      <input value={formState.name} onChange={(event) => updateFormField("name", event.target.value)} />
                    </label>

                    <label className="editor-field">
                      <span>Environment</span>
                      <textarea
                        rows={4}
                        value={formState.env}
                        onChange={(event) => updateFormField("env", event.target.value)}
                        placeholder="KEY=VALUE"
                      />
                    </label>

                    <label className="editor-field">
                      <span>Run</span>
                      <textarea rows={4} value={formState.run} onChange={(event) => updateFormField("run", event.target.value)} />
                    </label>
                  </>
                ) : null}

                <label className="editor-field">
                  <span>Body</span>
                  <textarea rows={10} value={formState.body} onChange={(event) => updateFormField("body", event.target.value)} />
                </label>

                <div className="editor-actions">
                  <button className="primary-button" type="submit" disabled={savingDocument || deletingDocument}>
                    {savingDocument ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setFormState(createDocumentFormState(selectedDocument));
                      setMutationError("");
                      setMutationSuccess("");
                      setIsEditing(false);
                    }}
                    disabled={savingDocument || deletingDocument}
                  >
                    Cancel
                  </button>
                  <button
                    className="danger-button-inline"
                    type="button"
                    onClick={() => void handleDeleteDocument()}
                    disabled={savingDocument || deletingDocument}
                  >
                    {deletingDocument ? "Deleting..." : "Delete document"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <dl className="detail-meta">
                  <div>
                    <dt>ID</dt>
                    <dd>{selectedDocument.id}</dd>
                  </div>
                  <div>
                    <dt>Graph</dt>
                    <dd>{selectedDocument.graph}</dd>
                  </div>
                  <div>
                    <dt>Feature</dt>
                    <dd>{selectedDocument.featureSlug}</dd>
                  </div>
                  <div>
                    <dt>Path</dt>
                    <dd>{selectedDocument.path}</dd>
                  </div>
                  {selectedDocument.status ? (
                    <div>
                      <dt>Status</dt>
                      <dd>{selectedDocument.status}</dd>
                    </div>
                  ) : null}
                  {selectedDocument.name ? (
                    <div>
                      <dt>Name</dt>
                      <dd>{selectedDocument.name}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="chip-list">
                  {(selectedDocument.tags ?? []).map((tag) => (
                    <span key={tag} className="meta-chip meta-chip-tag">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="detail-toolbar">
                  <button className="secondary-button" onClick={() => setIsEditing(true)}>
                    Edit document
                  </button>
                  <button className="danger-button-inline" onClick={() => void handleDeleteDocument()} disabled={deletingDocument}>
                    {deletingDocument ? "Deleting..." : "Delete document"}
                  </button>
                </div>

                {(selectedDocument.dependsOn ?? []).length > 0 ? (
                  <section className="detail-section">
                    <h4>Dependencies</h4>
                    <div className="link-list">
                      {(selectedDocument.dependsOn ?? []).map((dependencyId) => (
                        <button key={dependencyId} className="link-pill" onClick={() => setSelectedDocumentId(dependencyId)}>
                          {dependencyId}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {(selectedDocument.references ?? []).length > 0 ? (
                  <section className="detail-section">
                    <h4>References</h4>
                    <div className="link-list">
                      {(selectedDocument.references ?? []).map((referenceId) => (
                        <button key={referenceId} className="link-pill" onClick={() => setSelectedDocumentId(referenceId)}>
                          {referenceId}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {(selectedDocument.relatedNoteIds ?? []).length > 0 ? (
                  <section className="detail-section">
                    <h4>Related Notes</h4>
                    <div className="link-list">
                      {(selectedDocument.relatedNoteIds ?? []).map((noteId) => (
                        <button key={noteId} className="link-pill" onClick={() => setSelectedDocumentId(noteId)}>
                          {noteId}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {selectedDocument.env !== undefined && Object.keys(selectedDocument.env).length > 0 ? (
                  <section className="detail-section">
                    <h4>Environment</h4>
                    <div className="env-grid">
                      {Object.entries(selectedDocument.env).map(([key, value]) => (
                        <div key={key} className="env-row">
                          <span>{key}</span>
                          <code>{value}</code>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {selectedDocument.run ? (
                  <section className="detail-section">
                    <h4>Run</h4>
                    <pre className="run-block">{selectedDocument.run}</pre>
                  </section>
                ) : null}

                <section className="detail-section">
                  <h4>Body</h4>
                  <article
                    className="markdown-body"
                    dangerouslySetInnerHTML={{ __html: markdown.render(selectedDocument.body) }}
                  />
                </section>
              </>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

type GraphGroupProps = {
  label: string;
  graphs: GraphListResponse | null;
  selectedGraph: string;
  onSelectGraph: (graphName: string) => void;
  interactive: boolean;
};

function GraphGroup({ label, graphs, selectedGraph, onSelectGraph, interactive }: GraphGroupProps) {
  return (
    <div className="graph-group">
      <h3>{label}</h3>
      <div className="graph-list">
        {(graphs?.availableGraphs ?? []).map((graphName) => {
          const count = graphs?.graphItems[graphName]?.length ?? 0;
          return (
            <button
              key={graphName}
              className={interactive && selectedGraph === graphName ? "graph-button graph-button-active" : "graph-button"}
              disabled={!interactive}
              onClick={() => onSelectGraph(graphName)}
            >
              <span>{formatGraphTitle(graphName)}</span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function App() {
  return (
    <ReactFlowProvider>
      <FlowApp />
    </ReactFlowProvider>
  );
}