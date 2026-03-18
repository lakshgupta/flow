import Highlight from "@tiptap/extension-highlight";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { useEffect, useMemo, useState } from "react";

import { editorHTMLToMarkdown, markdownToHTML } from "./richText";

type SlashState = {
  query: string;
  range: { from: number; to: number };
};

export type WysiwygEditorProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  onReady?: (editor: Editor) => void;
};

type EditorCommand = {
  id: string;
  label: string;
  keywords: string[];
  run: (editor: Editor) => void;
};

function promptForLink(editor: Editor): void {
  const nextURL = window.prompt("Enter link URL", "https://");
  if (nextURL === null) {
    return;
  }

  const trimmed = nextURL.trim();
  if (trimmed === "") {
    editor.chain().focus().unsetLink().run();
    return;
  }

  editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
}

function detectSlashState(editor: Editor): SlashState | null {
  const selection = editor.state.selection;
  if (!selection.empty) {
    return null;
  }

  const parentOffset = selection.$from.parentOffset;
  const textBefore = selection.$from.parent.textBetween(0, parentOffset, "\0", "\0");
  const slashIndex = textBefore.lastIndexOf("/");
  if (slashIndex < 0) {
    return null;
  }

  const prefix = textBefore.slice(0, slashIndex);
  if (prefix !== "" && !/\s$/.test(prefix)) {
    return null;
  }

  const query = textBefore.slice(slashIndex + 1);
  if (!/^[a-z0-9-]*$/i.test(query)) {
    return null;
  }

  return {
    query: query.toLowerCase(),
    range: {
      from: selection.from - query.length - 1,
      to: selection.from,
    },
  };
}

function slashCommands(): EditorCommand[] {
  return [
    {
      id: "heading-1",
      label: "Heading 1",
      keywords: ["heading", "h1", "title"],
      run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: "heading-2",
      label: "Heading 2",
      keywords: ["heading", "h2", "section"],
      run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: "bullet-list",
      label: "Bulleted List",
      keywords: ["bullet", "list", "ul"],
      run: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: "task-list",
      label: "Checklist",
      keywords: ["check", "checklist", "todo", "task"],
      run: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
    {
      id: "blockquote",
      label: "Block Quote",
      keywords: ["quote", "blockquote"],
      run: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      id: "code-block",
      label: "Code Block",
      keywords: ["code", "snippet", "fence"],
      run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: "bold",
      label: "Bold",
      keywords: ["bold", "strong"],
      run: (editor) => editor.chain().focus().toggleBold().run(),
    },
    {
      id: "italic",
      label: "Italic",
      keywords: ["italic", "emphasis"],
      run: (editor) => editor.chain().focus().toggleItalic().run(),
    },
    {
      id: "link",
      label: "Link",
      keywords: ["link", "url"],
      run: (editor) => promptForLink(editor),
    },
    {
      id: "highlight",
      label: "Highlight",
      keywords: ["highlight", "mark"],
      run: (editor) => editor.chain().focus().toggleHighlight().run(),
    },
  ];
}

export function WysiwygEditor({ value, onChange, ariaLabel, placeholder, onReady }: WysiwygEditorProps) {
  const commands = useMemo(() => slashCommands(), []);
  const [slashState, setSlashState] = useState<SlashState | null>(null);
  const [hasTextSelection, setHasTextSelection] = useState(false);

  const editor = useEditor({
    content: markdownToHTML(value),
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class: "rich-editor-content",
        "data-placeholder": placeholder ?? "",
      },
    },
    extensions: [
      StarterKit,
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    immediatelyRender: false,
    onCreate({ editor: currentEditor }) {
      onReady?.(currentEditor);
    },
    onSelectionUpdate({ editor: currentEditor }) {
      setHasTextSelection(!currentEditor.state.selection.empty);
      setSlashState(detectSlashState(currentEditor));
    },
    onUpdate({ editor: currentEditor }) {
      setSlashState(detectSlashState(currentEditor));
      onChange(editorHTMLToMarkdown(currentEditor.getHTML()));
    },
  });

  useEffect(() => {
    if (editor === null) {
      return;
    }

    const serialized = editorHTMLToMarkdown(editor.getHTML());
    if (serialized !== value) {
      editor.commands.setContent(markdownToHTML(value), false);
      setSlashState(null);
    }
  }, [editor, value]);

  const visibleCommands = useMemo(() => {
    if (slashState === null) {
      return [];
    }

    return commands.filter((command) => {
      const haystack = `${command.label} ${command.keywords.join(" ")}`.toLowerCase();
      return haystack.includes(slashState.query);
    });
  }, [commands, slashState]);

  function applySlashCommand(command: EditorCommand): void {
    if (editor === null) {
      return;
    }

    if (slashState !== null) {
      editor.chain().focus().deleteRange(slashState.range).run();
    }

    command.run(editor);
    setSlashState(null);
  }

  if (editor === null) {
    return null;
  }

  return (
    <div className="rich-editor-shell" data-testid="wysiwyg-editor-shell">
      {hasTextSelection ? (
        <div className="rich-editor-bubble" data-testid="wysiwyg-bubble-menu">
          <button className="link-pill" onClick={() => editor.chain().focus().toggleBold().run()} type="button">
            Bold
          </button>
          <button className="link-pill" onClick={() => editor.chain().focus().toggleItalic().run()} type="button">
            Italic
          </button>
          <button className="link-pill" onClick={() => promptForLink(editor)} type="button">
            Link
          </button>
          <button className="link-pill" onClick={() => editor.chain().focus().toggleHighlight().run()} type="button">
            Highlight
          </button>
        </div>
      ) : null}

      <EditorContent editor={editor} />

      {slashState !== null && visibleCommands.length > 0 ? (
        <div className="rich-editor-slash-menu" data-testid="wysiwyg-slash-menu">
          {visibleCommands.map((command) => (
            <button
              key={command.id}
              className="rich-editor-slash-item"
              onClick={() => applySlashCommand(command)}
              type="button"
            >
              {command.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
