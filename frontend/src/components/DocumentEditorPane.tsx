import { memo, type CSSProperties, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { Maximize2, Minimize2, Trash2, X } from "lucide-react";

import { TableOfContents, type TOCItem } from "./TableOfContents";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { RichTextEditor, type RichTextEditorHandle } from "./editor/RichTextEditor";

import { formatDocumentType } from "../lib/docUtils";
import type { DocumentFormState, DocumentResponse } from "../types";

type DocumentLinkDetail = {
	nodeId: string;
	context: string;
	graphPath: string;
};

type DocumentEditorPaneActions = {
	toggleMaximize: () => void;
	openDeleteDialog: () => void;
	closeDocument: () => void;
	updateFormField: (field: keyof DocumentFormState, value: string) => void;
	openInlineReference: (documentId: string, graphPath: string) => void;
	openDate: (date: string) => void;
	openThreadAsset: (assetHref: string, assetName: string, kind: "pdf" | "text") => void;
	clearEditorScrollTarget: () => void;
	handleFilesDrop: (files: FileList | File[]) => void;
	inspectDocument: (documentId: string, graphPath: string) => void;
	resizeTOC: (event: ReactMouseEvent<HTMLDivElement>) => void;
	navigateTOC: (headingSlug: string) => void;
};

export type DocumentEditorPaneProps = {
	selectedDocument: DocumentResponse | null;
	formState: DocumentFormState;
	panelError: string;
	mutationError: string;
	mutationSuccess: string;
	savingDocument: boolean;
	deletingDocument: boolean;
	isMaximized: boolean;
	tintColor?: string;
	tintStyle?: CSSProperties;
	documentTOCRatio: number;
	tocItems: TOCItem[];
	outgoingLinks: DocumentLinkDetail[];
	incomingLinks: DocumentLinkDetail[];
	rightRailDocumentLayoutRef: RefObject<HTMLDivElement | null>;
	rightRailDocumentEditorRef: RefObject<RichTextEditorHandle | null>;
	editorScrollTarget: string | null;
	actions: DocumentEditorPaneActions;
};

function DocumentEditorPaneComponent({
	selectedDocument,
	formState,
	panelError,
	mutationError,
	mutationSuccess,
	savingDocument,
	deletingDocument,
	isMaximized,
	tintColor,
	tintStyle,
	documentTOCRatio,
	tocItems,
	outgoingLinks,
	incomingLinks,
	rightRailDocumentLayoutRef,
	rightRailDocumentEditorRef,
	editorScrollTarget,
	actions,
}: DocumentEditorPaneProps) {
	return (
		<div
			className={`sidebar-document-panel${tintColor ? " sidebar-document-panel-tinted" : ""}`}
			style={tintStyle}
			aria-label="Graph node document panel"
		>
			<div className="sidebar-document-toolbar">
				<div className="center-document-toolbar-leading">
					{selectedDocument !== null && (
						<Badge variant="outline">{formatDocumentType(selectedDocument.type)}</Badge>
					)}
					{savingDocument && <span className="home-save-success">Saving…</span>}
				</div>
				<div className="sidebar-document-toolbar-actions">
					<Button
						onClick={actions.toggleMaximize}
						type="button"
						variant="ghost"
						size="sm"
						aria-label={isMaximized ? "Minimize right pane" : "Maximize right pane"}
					>
						{isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
					</Button>
					{selectedDocument !== null && (
						<Button onClick={actions.openDeleteDialog} disabled={deletingDocument} type="button" variant="ghost" size="sm">
							<Trash2 size={16} />
						</Button>
					)}
					<Button
						onClick={actions.closeDocument}
						type="button"
						variant="ghost"
						size="sm"
						aria-label="Close document"
					>
						<X size={16} />
					</Button>
				</div>
			</div>

			{panelError !== "" ? <p className="status-line status-line-error">{panelError}</p> : null}
			{mutationError !== "" ? <p className="status-line status-line-error">{mutationError}</p> : null}
			{mutationSuccess !== "" ? <p className="status-line status-line-success">{mutationSuccess}</p> : null}

			{selectedDocument === null ? (
				<div className="detail-empty">
					<p>Loading document content.</p>
				</div>
			) : (
				<div
					ref={rightRailDocumentLayoutRef}
					className="sidebar-document-layout"
					aria-label="Graph node document"
					style={{ "--document-toc-ratio": documentTOCRatio.toString() } as CSSProperties}
					onDragEnter={(event) => { event.preventDefault(); }}
					onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
					onDrop={(event) => {
						event.preventDefault();
						const files = event.dataTransfer.files;
						if (!files || files.length === 0) {
							return;
						}
						actions.handleFilesDrop(files);
					}}
				>
					<div className="home-document">
						<div className="home-document-header">
							<input
								className="home-document-title"
								placeholder="Document title"
								value={formState.title}
								onChange={(event) => actions.updateFormField("title", event.target.value)}
								aria-label="Document title"
							/>
							<input
								className="home-document-description"
								placeholder="Add a brief description…"
								value={formState.description}
								onChange={(event) => actions.updateFormField("description", event.target.value)}
								aria-label="Document description"
							/>
						</div>
						<div className="home-document-body sidebar-document-body">
							<RichTextEditor
								ariaLabel="Context document editor"
								inlineReferences={selectedDocument.inlineReferences}
								onChange={(value) => actions.updateFormField("body", value)}
								onReferenceOpen={(documentId, graphPath) => actions.openInlineReference(documentId, graphPath)}
								onDateOpen={actions.openDate}
								onAssetOpenInThread={(assetHref, assetName, kind) => {
									actions.openThreadAsset(assetHref, assetName, kind);
								}}
								referenceLookupGraph={selectedDocument.graph}
								ref={rightRailDocumentEditorRef}
								onScrollCompleted={actions.clearEditorScrollTarget}
								placeholder="Type / for headings, lists, quotes, links, and highlights"
								scrollToHeadingSlug={editorScrollTarget}
								value={formState.body}
							/>
						</div>

						{(selectedDocument.tags ?? []).length > 0 && (
							<div className="chip-list">
								{(selectedDocument.tags ?? []).map((tag) => (
									<Badge key={tag} variant="secondary">
										{tag}
									</Badge>
								))}
							</div>
						)}

						{outgoingLinks.length > 0 && (
							<section className="detail-section">
								<h4>Outgoing Links</h4>
								<div className="link-list">
									{outgoingLinks.map((link) => (
										<Button
											key={`${link.nodeId}:${link.context}`}
											variant="outline"
											size="sm"
											onClick={() => actions.inspectDocument(link.nodeId, link.graphPath)}
											className="rounded-full h-7 px-3 text-xs"
											type="button"
										>
											{link.nodeId}{link.context ? ` — ${link.context}` : ""}
										</Button>
									))}
								</div>
							</section>
						)}

						{incomingLinks.length > 0 && (
							<section className="detail-section">
								<h4>Incoming Links</h4>
								<div className="link-list">
									{incomingLinks.map((link) => (
										<Button
											key={`${link.nodeId}:${link.context}`}
											variant="outline"
											size="sm"
											onClick={() => actions.inspectDocument(link.nodeId, link.graphPath)}
											className="rounded-full h-7 px-3 text-xs"
											type="button"
										>
											{link.nodeId}{link.context ? ` — ${link.context}` : ""}
										</Button>
									))}
								</div>
							</section>
						)}

						{selectedDocument.run && (
							<section className="detail-section">
								<h4>Run Command</h4>
								<pre className="run-block">{selectedDocument.run}</pre>
							</section>
						)}
					</div>

					<div
						className="sidebar-document-toc-resizer"
						onMouseDown={actions.resizeTOC}
						role="separator"
						aria-label="Resize table of contents"
						aria-orientation="vertical"
					/>

					<aside className="sidebar-document-toc" aria-label="Document table of contents">
						<div className="sidebar-document-toc-header">
							<h4>Table of Contents</h4>
						</div>
						<TableOfContents items={tocItems} onNavigate={actions.navigateTOC} />
					</aside>
				</div>
			)}
		</div>
	);
}

export const DocumentEditorPane = memo(DocumentEditorPaneComponent);
