import { AutocompleteEmpty } from 'prosekit/react/autocomplete'

export default function SlashMenuEmpty() {
  return (
    <AutocompleteEmpty className="relative flex items-center justify-between min-w-32 scroll-my-1 rounded-sm px-3 py-1.5 box-border cursor-default select-none whitespace-nowrap outline-hidden text-muted-foreground">
      <span>No results</span>
    </AutocompleteEmpty>
  )
}
