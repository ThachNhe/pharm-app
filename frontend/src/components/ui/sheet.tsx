import * as React from 'react';
import { Dialog as SheetPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
    return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
    return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetTitle(props: React.ComponentProps<typeof SheetPrimitive.Title>) {
    return <SheetPrimitive.Title data-slot="sheet-title" {...props} />;
}

function SheetContent({
    className,
    children,
    side = 'left',
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
    side?: 'left' | 'right';
}) {
    return (
        <SheetPrimitive.Portal>
            <SheetPrimitive.Overlay
                data-slot="sheet-overlay"
                className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/45"
            />
            <SheetPrimitive.Content
                data-slot="sheet-content"
                className={cn(
                    'data-[state=open]:animate-in data-[state=closed]:animate-out fixed inset-y-0 z-50 flex h-dvh flex-col shadow-xl outline-none data-[state=closed]:duration-200 data-[state=open]:duration-300',
                    side === 'left'
                        ? 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left left-0'
                        : 'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right right-0',
                    className
                )}
                {...props}
            >
                {children}
            </SheetPrimitive.Content>
        </SheetPrimitive.Portal>
    );
}

export { Sheet, SheetClose, SheetContent, SheetTitle };
