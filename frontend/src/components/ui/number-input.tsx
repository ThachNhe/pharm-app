import * as React from 'react';

import { cn } from '@/lib/utils';
import { Input } from './input';

// 15 digits stays within Number.MAX_SAFE_INTEGER.
const MAX_DIGITS = 15;
const groupFormatter = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
});

const countDigits = (text: string) => text.replace(/\D/g, '').length;

type NumberInputProps = Omit<
    React.ComponentProps<'input'>,
    'type' | 'value' | 'defaultValue' | 'onChange'
> & {
    value: number | null | undefined;
    // Emits null (not undefined) when cleared: react-hook-form treats undefined as "reset to default".
    onValueChange: (value: number | null) => void;
    suffix?: string;
};

/** Whole-number input that shows thousands separators (1.250.000) while typing. */
function NumberInput({
    ref,
    value,
    onValueChange,
    suffix,
    className,
    ...props
}: NumberInputProps) {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const caretDigits = React.useRef<number | null>(null);
    const display =
        value === null || value === undefined || !Number.isFinite(value)
            ? ''
            : groupFormatter.format(value);

    // Re-inserting separators moves the caret; restore it by digit position.
    React.useLayoutEffect(() => {
        const input = inputRef.current;
        const digitsBefore = caretDigits.current;
        if (!input || digitsBefore === null) return;
        caretDigits.current = null;
        let position = 0;
        let seen = 0;
        while (position < display.length && seen < digitsBefore) {
            if (/\d/.test(display[position])) seen += 1;
            position += 1;
        }
        input.setSelectionRange(position, position);
    });

    const setRefs = (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { value: raw, selectionStart } = event.target;
        const digits = raw
            .replace(/\D/g, '')
            .replace(/^0+(?=\d)/, '')
            .slice(0, MAX_DIGITS);
        caretDigits.current = Math.min(
            countDigits(raw.slice(0, selectionStart ?? raw.length)),
            digits.length
        );
        onValueChange(digits ? Number(digits) : null);
    };

    return (
        <div className="relative">
            <Input
                ref={setRefs}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={display}
                onChange={handleChange}
                className={cn(suffix && 'pr-14', className)}
                {...props}
            />
            {suffix ? (
                <span
                    aria-hidden="true"
                    className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm"
                >
                    {suffix}
                </span>
            ) : null}
        </div>
    );
}

export { NumberInput };
