import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { WysiwygEditor } from "./WysiwygEditor";

function ControlledEditor({ initialValue = "", onReady, onChangeSpy }: { initialValue?: string; onReady?: (editor: Editor) => void; onChangeSpy?: (value: string) => void }) {
  const [value, setValue] = useState(initialValue);

  return (
    <WysiwygEditor
      ariaLabel="Body editor"
      onChange={(nextValue) => {
        setValue(nextValue);
        onChangeSpy?.(nextValue);
      }}
      onReady={onReady}
      value={value}
    />
  );
}

describe("WysiwygEditor", () => {
  it("opens the slash-command menu when slash is typed", async () => {
    const user = userEvent.setup();

    render(<ControlledEditor />);

    const editor = screen.getByLabelText("Body editor");
    await user.click(editor);
    await user.keyboard("/");

    expect(await screen.findByTestId("wysiwyg-slash-menu")).toBeInTheDocument();
    expect(screen.getByText("Heading 1")).toBeInTheDocument();
  });

  it("shows the floating toolbar for a selection and persists highlight as mark HTML", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    let editorInstance: Editor | null = null;

    render(
      <ControlledEditor
        initialValue="Hello world\n"
        onChangeSpy={handleChange}
        onReady={(editor) => {
          editorInstance = editor;
        }}
      />,
    );

    await waitFor(() => {
      expect(editorInstance).not.toBeNull();
    });

    act(() => {
      editorInstance?.commands.focus();
      editorInstance?.commands.setTextSelection({ from: 1, to: 6 });
    });

    await waitFor(() => {
      expect(screen.getByTestId("wysiwyg-bubble-menu")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Highlight" }));

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled();
    });

    const serializedValues = handleChange.mock.calls.map((call) => call[0] as string);
    expect(serializedValues.some((value) => value.includes("<mark>Hello</mark>"))).toBe(true);
  });
});
