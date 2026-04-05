import { AutocompleteItem } from 'prosekit/react/autocomplete'

export default function SlashMenuItem(props: {
  label: string
  kbd?: string
  onSelect: () => void
}) {
  return (
    <AutocompleteItem onSelect={props.onSelect} className="relative flex items-center justify-between min-w-32 scroll-my-1 rounded-sm px-3 py-1.5 box-border cursor-default select-none whitespace-nowrap outline-hidden data-focused:bg-accent data-focused:text-accent-foreground">
      <span>{props.label}</span>
      {props.kbd && <kbd className="text-xs font-mono text-muted-foreground ml-4">{props.kbd}</kbd>}
    </AutocompleteItem>
  )
}
