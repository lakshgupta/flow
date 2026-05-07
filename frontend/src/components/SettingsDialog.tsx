import { Info, PaintbrushVertical, Trash2, TriangleAlert } from "lucide-react";
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

type SettingsTab = "general" | "theme" | "stop";

type SettingsDialogActions = {
  setOpen: (open: boolean) => void;
  setTab: (tab: SettingsTab) => void;
  rebuildIndex: () => void;
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

const SETTINGS_ITEMS = [
  { value: "general" as const, label: "General", icon: Info },
  { value: "theme" as const, label: "Appearance", icon: PaintbrushVertical },
  { value: "stop" as const, label: "Danger Zone", icon: TriangleAlert },
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
      <DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Customize your settings here.</DialogDescription>
        <SidebarProvider className="items-start">
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
          <main className="flex h-[480px] flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <span className="text-sm text-muted-foreground">Settings</span>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {settingsTab === "general" ? "General" : settingsTab === "theme" ? "Appearance" : "Danger Zone"}
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
                        <Label>Local workspaces</Label>
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