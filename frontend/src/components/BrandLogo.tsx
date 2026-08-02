import { APP_NAME } from '@/lib/constants'
import { cn } from '@/lib/utils'

type BrandMarkProps = {
  className?: string
  decorative?: boolean
}

type BrandLogoProps = {
  className?: string
  markClassName?: string
  nameClassName?: string
  subtitle?: string
}

const appSuffix = APP_NAME.endsWith('App') ? 'App' : ''
const brandName = appSuffix ? APP_NAME.slice(0, -appSuffix.length) : APP_NAME

export function BrandMark({ className, decorative = false }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-10 shrink-0', className)}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `Biểu tượng ${APP_NAME}`}
    >
      <rect x="2" y="2" width="44" height="44" rx="13" fill="#0A3D52" />
      <path
        d="M13.5 10.5h13.75c6.9 0 11.25 3.94 11.25 9.85 0 5.97-4.35 9.9-11.25 9.9H21V38h-7.5V10.5Z"
        fill="#F8FCFD"
      />
      <rect
        x="21"
        y="15.3"
        width="12.2"
        height="9.9"
        rx="4.95"
        fill="#4BBFA0"
      />
      <path
        d="M27.1 15.85v8.8"
        stroke="#F8FCFD"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function BrandLogo({
  className,
  markClassName,
  nameClassName,
  subtitle,
}: BrandLogoProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <BrandMark className={markClassName} decorative />
      <div className="min-w-0">
        <p
          className={cn(
            'truncate text-base font-semibold tracking-[-0.025em] text-brand-navy dark:text-foreground',
            nameClassName,
          )}
        >
          <span>{brandName}</span>
          {appSuffix ? <span className="text-primary">{appSuffix}</span> : null}
        </p>
        {subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  )
}
