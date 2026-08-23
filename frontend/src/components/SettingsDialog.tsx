import { FolderTree, Info, Keyboard, PaintbrushVertical, Trash2, TriangleAlert } from "lucide-react";
import { memo } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "./ui/sidebar";

import type { WorkspaceResponse } from "../types";

type SettingsTab = "general" | "workspaces" | "about" | "theme" | "keyboard" | "stop";

type SettingsDialogActions = {
  setOpen: (open: boolean) => void;
  setTab: (tab: SettingsTab) => void;
  rebuildIndex: () => void;
  downloadWorkspaceData: () => void;
  deregisterWorkspace: (workspacePath: string) => void;
  changeAppearance: (appearance: "light" | "dark" | "system") => void;
  stopGUI: () => void;
};

export type SettingsDialogProps = {
  open: boolean;
  settingsTab: SettingsTab;
  workspace: WorkspaceResponse | null;
  trackedLocalWorkspaces: Array<{ scope: string; workspacePath: string }>;
  switchingWorkspace: boolean;
  rebuildingIndex: boolean;
  stoppingGUI: boolean;
  appearance: "light" | "dark" | "system";
  actions: SettingsDialogActions;
};

type ShortcutEntry = {
  keys: string;
  action: string;
};

type ShortcutGroup = {
  title: string;
  shortcuts: ShortcutEntry[];
};

const KEYBOARD_SHORTCUTS: ShortcutGroup[] = [
  {
    title: "General",
    shortcuts: [
      { keys: "Ctrl/Cmd + \\", action: "Toggle the left sidebar" },
      { keys: "Alt + ← / Alt + →", action: "Switch between open threads" },
      { keys: "Alt + Shift + F", action: "Fix all edge violations in the current graph" },
      { keys: "Ctrl/Cmd + click", action: "Add a node to the selection (multi-select)" },
    ],
  },
  {
    title: "Canvas",
    shortcuts: [
      { keys: "Ctrl/Cmd + scroll (pinch)", action: "Zoom the canvas in and out" },
      { keys: "↑ / ↓", action: "Navigate node search results" },
      { keys: "Shift + Enter", action: "Jump to the previous search match" },
      { keys: "Enter", action: "Jump to the next search match" },
    ],
  },
  {
    title: "Presentation mode (graph canvas)",
    shortcuts: [
      { keys: "P", action: "Enter presentation mode from the graph canvas" },
      { keys: "→", action: "Drill into the highlighted connected node" },
      { keys: "←", action: "Step back to the previous node" },
      { keys: "↓", action: "Move to the next connected node (canvas order, topmost first)" },
      { keys: "↑", action: "Move to the previous connected node" },
      { keys: "Enter", action: "Open the current slide in the editor" },
      { keys: "Esc", action: "Exit presentation mode" },
    ],
  },
  {
    title: "Search",
    shortcuts: [
      { keys: "Ctrl/Cmd + F", action: "Find in current document, thread, or Home (local)" },
      { keys: "Ctrl/Cmd + Shift + F", action: "Search across workspace (global right panel)" },
      { keys: "Enter", action: "Next match in local find" },
      { keys: "Shift + Enter", action: "Previous match in local find" },
      { keys: "Esc", action: "Close local find bar" },
    ],
  },
  {
    title: "Text formatting",
    shortcuts: [
      { keys: "Ctrl/Cmd + B", action: "Bold" },
      { keys: "Ctrl/Cmd + I", action: "Italic" },
      { keys: "Ctrl/Cmd + U", action: "Underline" },
      { keys: "Ctrl/Cmd + Shift + S", action: "Strikethrough" },
      { keys: "Ctrl/Cmd + E", action: "Inline code" },
      { keys: "Ctrl/Cmd + Shift + B", action: "Blockquote" },
      { keys: "Ctrl/Cmd + Alt + 1–6", action: "Apply heading level 1–6" },
      { keys: "Ctrl/Cmd + Alt + 0", action: "Set paragraph text" },
      { keys: "Ctrl/Cmd + [ / ]", action: "Decrease / increase list indent" },
      { keys: "Ctrl/Cmd + Enter", action: "Insert a hard line break" },
      { keys: "Ctrl/Cmd + Z", action: "Undo" },
      { keys: "Ctrl/Cmd + Shift + Z (or Ctrl/Cmd + Y)", action: "Redo" },
      { keys: "Ctrl/Cmd + click on link", action: "Open the link in the browser" },
    ],
  },
  {
    title: "Markdown shortcuts (type at the start of a line)",
    shortcuts: [
      { keys: "# / ## / ###", action: "Heading 1 / 2 / 3" },
      { keys: "-", action: "Bullet list" },
      { keys: "1.", action: "Ordered list" },
      { keys: "[]", action: "Task list" },
      { keys: ">>", action: "Toggle list" },
      { keys: ">", action: "Quote" },
      { keys: "---", action: "Horizontal divider" },
      { keys: "```", action: "Code block" },
      { keys: "/code", action: "Insert a code block (slash menu)" },
      { keys: "/mermaid", action: "Insert a Mermaid diagram (slash menu)" },
    ],
  },
  {
    title: "Tables",
    shortcuts: [
      { keys: "Tab / Shift + Tab", action: "Move to the next / previous cell" },
      { keys: "Arrow keys", action: "Move between cells" },
      { keys: "Ctrl/Cmd + A", action: "Select the whole table" },
      { keys: "Backspace / Delete at the table edge", action: "Delete the whole table" },
    ],
  },
  {
    title: "Images & diagrams",
    shortcuts: [
      { keys: "Tab / Shift + Tab (image selected)", action: "Indent / outdent the image" },
      { keys: "Alt + ↑ / ↓ (diagram selected)", action: "Move the diagram up / down" },
    ],
  },
];

const SETTINGS_ITEMS = [
  { value: "general" as const, label: "General", icon: Info },
  { value: "workspaces" as const, label: "Workspaces", icon: FolderTree },
  { value: "about" as const, label: "About", icon: Info },
  { value: "theme" as const, label: "Appearance", icon: PaintbrushVertical },
  { value: "keyboard" as const, label: "Keyboard", icon: Keyboard },
  { value: "stop" as const, label: "Advanced", icon: TriangleAlert },
];

function SettingsDialogComponent({
  open,
  settingsTab,
  workspace,
  trackedLocalWorkspaces,
  switchingWorkspace,
  rebuildingIndex,
  stoppingGUI,
  appearance,
  actions,
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={actions.setOpen}>
      <DialogContent
        showCloseButton={false}
        className="w-full p-0 gap-0 max-h-[85vh] overflow-hidden grid-rows-[minmax(0,1fr)]"
        style={{ maxWidth: 'min(1200px, calc(100vw - 2rem))' }}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Customize your settings here.</DialogDescription>
        {/* The sidebar provider's base class forces min-height: 100svh, which
            stretches the layout taller than this dialog's max-h-[85vh] and clips
            the scroll area below the visible edge. Override the floor with an
            inline style so tall tabs (e.g. Keyboard) scroll to the end. */}
        <SidebarProvider className="items-start bg-background" style={{ height: "85vh", minHeight: "500px" }}>
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {SETTINGS_ITEMS.map((item) => (
                      <SidebarMenuItem key={item.value}>
                        <SidebarMenuButton
                          isActive={settingsTab === item.value}
                          onClick={() => actions.setTab(item.value)}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-full flex-1 flex-col overflow-hidden">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <span className="text-sm text-muted-foreground">Settings</span>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {settingsTab === "general"
                        ? "General"
                        : settingsTab === "workspaces"
                          ? "Workspaces"
                          : settingsTab === "about"
                            ? "About"
                          : settingsTab === "theme"
                            ? "Appearance"
                          : settingsTab === "keyboard"
                            ? "Keyboard"
                            : "Advanced"}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
              {settingsTab === "general" && (
                workspace ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <Label>Path</Label>
                      <div className="text-sm text-muted-foreground break-all">{workspace.workspacePath}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>Scope</Label>
                      <div className="text-sm text-muted-foreground">{workspace.scope}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>GUI Port</Label>
                      <div className="text-sm text-muted-foreground">{workspace.guiPort}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>Config</Label>
                      <div className="text-sm text-muted-foreground break-all">{workspace.configPath}</div>
                    </div>
                    <div className="flex flex-col gap-3 rounded-lg border p-4">
                      <div className="flex flex-col gap-1">
                        <Label>Refresh index</Label>
                        <p className="text-sm text-muted-foreground">
                          Rebuild the derived index after files are changed outside the app so search, graphs, and open documents reflect the latest state.
                        </p>
                      </div>
                      <div>
                        <Button disabled={rebuildingIndex} onClick={actions.rebuildIndex} type="button" variant="outline">
                          {rebuildingIndex ? "Refreshing index..." : "Refresh index"}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 rounded-lg border p-4">
                      <div className="flex flex-col gap-1">
                        <Label>Export workspace data</Label>
                        <p className="text-sm text-muted-foreground">
                          Download this workspace as a zip archive, including `.flow/data` and workspace config files.
                        </p>
                      </div>
                      <div>
                        <Button onClick={actions.downloadWorkspaceData} type="button" variant="outline">
                          Download workspace zip
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No workspace loaded.</p>
                )
              )}
              {settingsTab === "workspaces" && (
                workspace ? (
                  <div className="flex flex-col gap-3 rounded-lg border p-4">
                    <div className="flex flex-col gap-1">
                      <Label>Registered local workspaces</Label>
                      <p className="text-sm text-muted-foreground">
                        De-register local workspaces from this global workspace list. This does not delete files.
                      </p>
                    </div>
                    {trackedLocalWorkspaces.length > 0 ? (
                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1" aria-label="Registered local workspaces">
                        {trackedLocalWorkspaces.map((entry) => {
                          const isActive = workspace.scope === "local" && workspace.workspacePath === entry.workspacePath;
                          return (
                            <div key={`local-workspace-${entry.workspacePath}`} className="flex items-center justify-between gap-2 rounded-md border p-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm" title={entry.workspacePath}>{entry.workspacePath}</div>
                                {isActive ? <div className="text-xs text-muted-foreground">Currently active</div> : null}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => actions.deregisterWorkspace(entry.workspacePath)}
                                disabled={switchingWorkspace}
                                aria-label={`De-register ${entry.workspacePath}`}
                              >
                                <Trash2 size={14} />
                                De-register
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No local workspaces are currently registered.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No workspace loaded.</p>
                )
              )}
              {settingsTab === "theme" && (
                <RadioGroup value={appearance} onValueChange={(value) => actions.changeAppearance(value as "light" | "dark" | "system")}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="light" id="r1" />
                    <Label htmlFor="r1">Light</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="dark" id="r2" />
                    <Label htmlFor="r2">Dark</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="system" id="r3" />
                    <Label htmlFor="r3">System</Label>
                  </div>
                </RadioGroup>
              )}
              {settingsTab === "about" && (
                workspace ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <Label>Flow version</Label>
                      <div className="text-sm text-muted-foreground">{workspace.appVersion ?? "unknown"}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>License</Label>
                      <div className="text-sm text-muted-foreground">{workspace.licenseText ?? "Apache License 2.0"}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>Copyright</Label>
                      <div className="text-sm text-muted-foreground">{workspace.copyrightText ?? "Copyright (c) Flow contributors"}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No workspace loaded.</p>
                )
              )}
              {settingsTab === "keyboard" && (
                <div className="flex flex-col gap-4">
                  {KEYBOARD_SHORTCUTS.map((group) => (
                    <div key={group.title} className="flex flex-col gap-2">
                      <h3 className="text-sm font-medium">{group.title}</h3>
                      <div className="flex flex-col divide-y rounded-lg border">
                        {group.shortcuts.map((shortcut) => (
                          <div key={`${group.title}-${shortcut.keys}`} className="flex items-center justify-between gap-4 px-3 py-2">
                            <span className="text-sm text-muted-foreground">{shortcut.action}</span>
                            <kbd className="shrink-0 rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{shortcut.keys}</kbd>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {settingsTab === "stop" && (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    This closes the loopback server for the current workspace until you run Flow GUI again.
                  </p>
                  <Button disabled={stoppingGUI} onClick={actions.stopGUI} type="button" variant="destructive">
                    {stoppingGUI ? "Stopping GUI..." : "Stop GUI"}
                  </Button>
                </div>
              )}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}

export const SettingsDialog = memo(SettingsDialogComponent);