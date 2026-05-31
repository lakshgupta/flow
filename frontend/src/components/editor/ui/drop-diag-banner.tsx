import { cn } from '@/lib/utils'

export interface DropDiagEntry {
  id: number
  message: string
  timestamp: Date
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function DropDiagBanner({
  messages,
  onClose,
  onCloseAll,
}: {
  messages: DropDiagEntry[]
  onClose: (id: number) => void
  onCloseAll: () => void
}) {
  if (messages.length === 0) return null

  return (
    <div className="relative z-50 shrink-0">
      {messages.map((entry, index) => (
        <div
          key={entry.id}
          className={cn(
            'flex items-start gap-2 text-xs font-mono px-3 py-1.5 border-b border-yellow-300 whitespace-pre-wrap',
            'bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100',
            index > 0 && 'border-t border-yellow-400 dark:border-yellow-600',
          )}
        >
          <span className="shrink-0 opacity-60 tabular-nums">[{formatTime(entry.timestamp)}]</span>
          <span className="flex-1 min-w-0 break-all">{entry.message}</span>
          {messages.length > 1 && (
            <button
              type="button"
              onClick={onCloseAll}
              className="shrink-0 text-[10px] underline opacity-60 hover:opacity-100"
            >
              Close all
            </button>
          )}
          <button
            type="button"
            onClick={() => onClose(entry.id)}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-yellow-200 dark:hover:bg-yellow-800 text-yellow-700 dark:text-yellow-300 cursor-pointer"
            aria-label="Close diagnostic banner"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
