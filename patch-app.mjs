import fs from 'fs';

const appFile = 'frontend/src/App.tsx';
let content = fs.readFileSync(appFile, 'utf-8');

const functionString = `
  const renderCenterDocumentShell = (isMaximizedRightRail: boolean) => (
    <div className="center-document-shell">
      <div className="center-document-toolbar">
        <div className="center-document-toolbar-leading">
          {selectedDocument !== null && (
            <Badge variant="outline" className="center-document-type-badge">{formatDocumentType(selectedDocument.type)}</Badge>
          )}
          {selectedDocument !== null && (
            <>
              <Separator className="center-document-toolbar-separator" orientation="vertical" />
              <input
                className="center-document-toolbar-title"
                placeholder="Document title"
                value={formState.title}
                onChange={(event) => updateFormField("title", event.target.value)}
                aria-label="Document title"
              />
            </>
          )}
          {savingDocument && <span className="home-save-success">Saving…</span>}
        </div>
        <div className="center-document-toolbar-actions">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="center-document-toolbar-toggle"
            data-active={centerDocumentSidePanelMode === "toc" ? "true" : "false"}
            aria-label="Toggle table of contents"
            aria-pressed={centerDocumentSidePanelMode === "toc"}
            title="Toggle table of contents"
            onClick={() => toggleCenterDocumentSidePanel("toc")}
          >
            <FileText size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="center-document-toolbar-toggle"
            data-active={centerDocumentSidePanelMode === "properties" ? "true" : "false"}
            aria-label="Toggle document properties"
            aria-pressed={centerDocumentSidePanelMode === "properties"}
            title="Toggle document properties"
            onClick={() => toggleCenterDocumentSidePanel("properties")}
          >
            <Info size={16} />
          </Button>
          {isMaximizedRightRail && (
            <Button
              onClick={() => toggleRightRailMaximized()}
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Minimize right pane"
            >
              <Minimize2 size={16} />
            </Button>
          )}
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
          ref={centerDocumentLayoutRef}
          className="center-document-layout"
          aria-label="Document content layout"
          data-side-panel={centerDocumentSidePanelMode}
          style={{ "--document-toc-ratio": documentTOCRatio.toString() } as React.CSSProperties}
        >
          <div className="center-document-main home-document">
            <div className="home-document-body center-document-body">
              <RichTextEditor
                ariaLabel="Document body editor"
                onChange={(value) => updateFormField("body", value)}
                onScrollCompleted={() => setEditorScrollTarget(null)}
                placeholder="Type / for headings, lists, quotes, links, and highlights"
                scrollToHeadingSlug={editorScrollTarget}
                value={formState.body}
              />
            </div>
          </div>

          {showCenterDocumentSidePanel ? (
            <>
              <div
                className="center-document-toc-resizer"
                onMouseDown={handleDocumentTOCResizeMouseDown}
                role="separator"
                aria-label={centerDocumentSidePanelResizerLabel}
                aria-orientation="vertical"
              />

              <aside className="center-document-side-panel" aria-label={centerDocumentSidePanelLabel}>
                <div className="center-document-toc-header center-document-side-panel-header">
                  <h4>{centerDocumentSidePanelTitle}</h4>
                  <p>{centerDocumentSidePanelDescription}</p>
                </div>

                {centerDocumentSidePanelMode === "toc" ? (
                  <TableOfContents items={tocItems} onNavigate={handleTOCNavigate} />
                ) : (
                  <DocumentPropertiesPanel
                    selectedDocument={selectedDocument}
                    formState={formState}
                    updateFormField={updateFormField}
                  />
                )}
              </aside>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
`;

// Insert the function before the main return statement of App
const insertAnchor = `  return (
    <SidebarProvider
      className={isResizingLeft`;
content = content.replace(insertAnchor, functionString + '\n' + insertAnchor);

// Now replace the center document shell
const centerShellStart = `            <div className="center-document-shell">`;
const centerShellEndRegex = /(<aside className="center-document-side-panel"[^>]+>[\s\S]*?<\/aside>[\s\S]*?<\/>\s*\) : null\}\s*<\/div>\s*\)\}\s*<\/div>\s*\) : \(\s*<div className="graph-canvas-outer">)/m;

const parts = content.split(") : isCenterDocumentOpen ? (");
if (parts.length === 2) {
   let afterCenter = parts[1];
   let graphOuterIndex = afterCenter.indexOf("          ) : (\\n            <div className=\"graph-canvas-outer\">");
   
   // It's easier just to regex match from <div className="center-document-shell"> down to <div className="graph-canvas-outer">
   
} else {
   console.log("Could not find isCenterDocumentOpen ? (");
}
