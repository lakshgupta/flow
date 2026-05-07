import { memo } from "react";

import { formatDocumentType } from "../lib/docUtils";
import type { GraphCreateType } from "../types";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type DeleteDocumentDialogActions = {
  setOpen: (open: boolean) => void;
  cancel: () => void;
  confirm: () => void;
};

export type DeleteDocumentDialogProps = {
  open: boolean;
  target: { title: string } | null;
  savingDocument: boolean;
  deletingDocument: boolean;
  actions: DeleteDocumentDialogActions;
};

function DeleteDocumentDialogComponent({
  open,
  target,
  savingDocument,
  deletingDocument,
  actions,
}: DeleteDocumentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={actions.setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete document?</DialogTitle>
          <DialogDescription>
            {target === null
              ? "This removes the selected document from the workspace."
              : `This removes ${target.title} from the workspace.`}
          </DialogDescription>
        </DialogHeader>
        <div className="shell-dialog-actions">
          <Button onClick={actions.cancel} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={savingDocument || deletingDocument || target === null}
            onClick={actions.confirm}
            type="button"
            variant="destructive"
          >
            {deletingDocument ? "Deleting..." : "Delete document"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type CreateNodeDialogActions = {
  setOpen: (open: boolean) => void;
  setFileName: (value: string) => void;
  cancel: () => void;
  confirm: () => void;
};

export type CreateNodeDialogProps = {
  dialog: { type: GraphCreateType } | null;
  fileName: string;
  fileNameError: string;
  pending: boolean;
  actions: CreateNodeDialogActions;
};

function CreateNodeDialogComponent({
  dialog,
  fileName,
  fileNameError,
  pending,
  actions,
}: CreateNodeDialogProps) {
  return (
    <Dialog open={dialog !== null} onOpenChange={actions.setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New {dialog ? formatDocumentType(dialog.type) : ""}</DialogTitle>
          <DialogDescription>
            Choose a file name for the new document. Use letters, numbers, hyphens, underscores, dots, and slashes.
          </DialogDescription>
        </DialogHeader>
        <div className="shell-dialog-actions" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
          <Label htmlFor="create-node-filename">File name</Label>
          <Input
            id="create-node-filename"
            value={fileName}
            onChange={(event) => actions.setFileName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                actions.confirm();
              }
            }}
            placeholder="my-task"
            autoFocus
          />
          {fileNameError !== "" ? <p className="status-line status-line-error">{fileNameError}</p> : null}
          <div className="shell-dialog-actions">
            <Button onClick={actions.cancel} type="button" variant="secondary">
              Cancel
            </Button>
            <Button onClick={actions.confirm} type="button" disabled={pending}>
              {pending ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type RenameDialogActions = {
  setOpen: (open: boolean) => void;
  setValue: (value: string) => void;
  cancel: () => void;
  confirm: () => void;
};

export type RenameDialogProps = {
  dialog: { kind: "graph"; graphPath: string } | { kind: "node"; fileName: string } | null;
  value: string;
  error: string;
  pending: boolean;
  actions: RenameDialogActions;
};

function RenameDialogComponent({
  dialog,
  value,
  error,
  pending,
  actions,
}: RenameDialogProps) {
  return (
    <Dialog open={dialog !== null} onOpenChange={actions.setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialog?.kind === "graph" ? "Rename graph" : "Rename node"}</DialogTitle>
          <DialogDescription>
            {dialog?.kind === "graph"
              ? "Choose the new graph path for this content tree entry."
              : "Choose the new file name for this node. The .md extension is optional."}
          </DialogDescription>
        </DialogHeader>
        <div className="shell-dialog-actions" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
          <Label htmlFor="rename-input">{dialog?.kind === "graph" ? "Graph path" : "File name"}</Label>
          <Input
            id="rename-input"
            value={value}
            onChange={(event) => actions.setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                actions.confirm();
              }
            }}
            placeholder={dialog?.kind === "graph" ? "projects/backend" : "my-task"}
            autoFocus
          />
          {error !== "" ? <p className="status-line status-line-error">{error}</p> : null}
          <div className="shell-dialog-actions">
            <Button onClick={actions.cancel} type="button" variant="secondary">
              Cancel
            </Button>
            <Button onClick={actions.confirm} type="button" disabled={pending}>
              {pending ? "Renaming..." : "Rename"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const DeleteDocumentDialog = memo(DeleteDocumentDialogComponent);
export const CreateNodeDialog = memo(CreateNodeDialogComponent);
export const RenameDialog = memo(RenameDialogComponent);