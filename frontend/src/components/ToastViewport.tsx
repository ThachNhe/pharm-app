import { useEffect } from 'react'
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/useUIStore'

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const tones = {
  success: 'border-primary/25 bg-secondary text-secondary-foreground',
  error: 'border-destructive/25 bg-destructive/10 text-foreground',
  warning: 'border-warning/30 bg-warning/10 text-foreground',
  info: 'border-info/25 bg-info/10 text-foreground',
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: ReturnType<typeof useUIStore.getState>['toasts'][number]
  onRemove: (id: string) => void
}) {
  const Icon = icons[toast.type]

  useEffect(() => {
    const timeoutId = window.setTimeout(() => onRemove(toast.id), 4500)
    return () => window.clearTimeout(timeoutId)
  }, [onRemove, toast.id])

  return (
    <div
      className={cn(
        'grid w-full grid-cols-[20px_minmax(0,1fr)_32px] gap-3 rounded-lg border p-4 shadow-lg backdrop-blur',
        tones[toast.type],
      )}
      role="status"
    >
      <Icon className="mt-0.5 size-5" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description ? (
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {toast.description}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onRemove(toast.id)}
        aria-label="Đóng thông báo"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}

export function ToastViewport() {
  const toasts = useUIStore((state) => state.toasts)
  const removeToast = useUIStore((state) => state.removeToast)

  if (!toasts.length) return null

  return (
    <div className="fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  )
}
