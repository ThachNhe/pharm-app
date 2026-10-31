import { cn } from '@/lib/utils';

type IllustrationProps = {
    className?: string;
};

function Leaf({
    transform,
    className,
}: {
    transform: string;
    className: string;
}) {
    return (
        <g transform={transform}>
            <path
                d="M0 0C18-26 54-28 72 0C54 24 18 24 0 0Z"
                className={className}
            />
            <path
                d="M6 0H64"
                className="stroke-brand-deep"
                strokeOpacity="0.25"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </g>
    );
}

function Sparkle({ x, y, size = 10 }: { x: number; y: number; size?: number }) {
    return (
        <path
            d={`M${x} ${y - size}V${y + size}M${x - size} ${y}H${x + size}`}
            className="stroke-brand-highlight"
            strokeWidth="3"
            strokeLinecap="round"
        />
    );
}

// Medicine bottle, capsule with leaves, pills and a blister pack; drawn for dark green surfaces.
export function PharmacyHeroIllustration({ className }: IllustrationProps) {
    return (
        <svg
            viewBox="0 0 400 300"
            xmlns="http://www.w3.org/2000/svg"
            className={cn('h-auto w-full', className)}
            aria-hidden="true"
            focusable="false"
        >
            <circle cx="220" cy="160" r="128" fill="#FFFFFF" opacity="0.06" />
            <circle cx="220" cy="160" r="88" fill="#FFFFFF" opacity="0.06" />

            <ellipse
                cx="200"
                cy="272"
                rx="170"
                ry="12"
                fill="#000000"
                opacity="0.12"
            />

            <g transform="rotate(14 330 205)">
                <rect
                    x="290"
                    y="180"
                    width="86"
                    height="54"
                    rx="12"
                    className="fill-illus-tint"
                />
                {[0, 1, 2, 3].map((column) =>
                    [0, 1].map((row) => (
                        <circle
                            key={`${column}-${row}`}
                            cx={304 + column * 19}
                            cy={196 + row * 22}
                            r="7"
                            fill="#FFFFFF"
                            className="stroke-brand-mid"
                            strokeWidth="2"
                        />
                    ))
                )}
            </g>

            <rect
                x="64"
                y="70"
                width="88"
                height="40"
                rx="10"
                className="fill-brand-highlight"
            />
            {[0, 1, 2, 3, 4].map((index) => (
                <path
                    key={index}
                    d={`M${78 + index * 15} 78V102`}
                    className="stroke-brand-deep"
                    strokeOpacity="0.2"
                    strokeWidth="3"
                    strokeLinecap="round"
                />
            ))}
            <rect
                x="52"
                y="104"
                width="112"
                height="164"
                rx="22"
                fill="#FFFFFF"
            />
            <rect
                x="66"
                y="146"
                width="84"
                height="78"
                rx="12"
                className="fill-illus-tint"
            />
            <rect
                x="99"
                y="163"
                width="18"
                height="44"
                rx="4"
                className="fill-primary"
            />
            <rect
                x="86"
                y="176"
                width="44"
                height="18"
                rx="4"
                className="fill-primary"
            />
            <rect
                x="68"
                y="118"
                width="10"
                height="132"
                rx="5"
                className="fill-illus-soft"
            />

            <Leaf
                transform="translate(236 72) rotate(-38)"
                className="fill-brand-mid"
            />
            <Leaf
                transform="translate(262 92) rotate(-8)"
                className="fill-brand-highlight"
            />
            <Leaf
                transform="translate(214 96) rotate(-80) scale(0.7)"
                className="fill-brand-highlight"
            />

            <g transform="rotate(-32 270 150)">
                <rect
                    x="200"
                    y="125"
                    width="140"
                    height="52"
                    rx="26"
                    fill="#FFFFFF"
                />
                <path
                    d="M226 125H270V177H226A26 26 0 0 1 226 125Z"
                    className="fill-brand-highlight"
                />
                <path
                    d="M218 138C222 133 228 131 236 131"
                    stroke="#FFFFFF"
                    strokeOpacity="0.7"
                    strokeWidth="4"
                    strokeLinecap="round"
                />
                <path
                    d="M270 125V177"
                    className="stroke-brand-deep"
                    strokeOpacity="0.12"
                    strokeWidth="3"
                />
            </g>

            <circle cx="214" cy="244" r="22" fill="#FFFFFF" />
            <path
                d="M198 244H230"
                className="stroke-illus-tint"
                strokeWidth="4"
                strokeLinecap="round"
            />
            <circle cx="262" cy="258" r="14" className="fill-illus-butter" />
            <circle cx="186" cy="214" r="9" className="fill-illus-lavender" />

            <Sparkle x={42} y={64} />
            <Sparkle x={352} y={70} size={8} />
            <Sparkle x={366} y={150} size={6} />
            <Sparkle x={188} y={40} size={6} />
        </svg>
    );
}

// Small capsule and leaf mark for empty states and compact cards.
export function CapsuleIllustration({ className }: IllustrationProps) {
    return (
        <svg
            viewBox="0 0 96 96"
            xmlns="http://www.w3.org/2000/svg"
            className={cn('size-20', className)}
            aria-hidden="true"
            focusable="false"
        >
            <circle cx="48" cy="48" r="44" className="fill-illus-tint" />
            <path
                d="M58 20C66 10 80 10 86 20C78 28 66 28 58 20Z"
                className="fill-brand-mid"
            />
            <g transform="rotate(-40 48 52)">
                <rect
                    x="20"
                    y="40"
                    width="56"
                    height="24"
                    rx="12"
                    fill="#FFFFFF"
                    className="stroke-brand-mid"
                    strokeWidth="2"
                />
                <path
                    d="M32 40H48V64H32A12 12 0 0 1 32 40Z"
                    className="fill-primary"
                />
            </g>
            <circle cx="26" cy="72" r="6" fill="#FFFFFF" />
            <circle cx="72" cy="74" r="4" className="fill-brand-highlight" />
        </svg>
    );
}
