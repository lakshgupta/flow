import { lazy, Suspense, type ComponentProps } from 'react'

const ExcalidrawInner = lazy(() =>
  import('@excalidraw/excalidraw').then((m) => ({ default: m.Excalidraw })),
)

type ExcalidrawInnerProps = ComponentProps<typeof ExcalidrawInner>

export function LazyExcalidraw(props: ExcalidrawInnerProps) {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center rounded-lg bg-(--card) animate-pulse"
          style={{ height: '400px', minHeight: '200px' }}
        >
          <span className="text-sm text-(--muted-foreground)">Loading diagram editor...</span>
        </div>
      }
    >
      <ExcalidrawInner {...props} />
    </Suspense>
  )
}
