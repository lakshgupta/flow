import { AutocompleteItem } from 'prosekit/react/autocomplete'
import { useCallback } from 'react'

export default function SlashMenuItem(props: {
  label: string
  kbd?: string
  onSelect: () => void
}) {
  // Set the value property synchronously in the ref callback so it is
  // available before the listbox's MutationObserver builds the Collection.
  // createComponent stores the element via useState, so its layout effect
  // that assigns el.value only runs on the *second* render — after a
  // MutationObserver microtask in WebKitGTK can already have snapshot the
  // (empty) values, excluding the item from the filtered list.
  const itemRef = useCallback(
    (el: HTMLElement | null) => {
      if (el) (el as { value: string }).value = props.label
    },
    [props.label],
  )

  return (
    <AutocompleteItem
      ref={itemRef}
      // Explicit `value` is required: the custom element falls back to
      // `element.textContent` for the filter value, but the React children
      // aren't reliably in the light DOM when the popover opens, which would
      // leave the value empty and hide the item from the filter.
      value={props.label}
      onSelect={props.onSelect}
      className="relative flex items-center justify-between min-w-32 scroll-my-1 rounded-sm px-3 py-1.5 box-border cursor-default select-none whitespace-nowrap outline-hidden data-focused:bg-accent data-focused:text-accent-foreground"
    >
      <span>{props.label}</span>
      {props.kbd && <kbd className="text-xs font-mono text-muted-foreground ml-4">{props.kbd}</kbd>}
    </AutocompleteItem>
  )
}
