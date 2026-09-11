'use client';

import { useState, type ReactNode } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from './ui';

/**
 * A destructive-action button that requires a second click to actually fire.
 * First click swaps the trigger for a short "Sure?" + Confirm/Cancel row,
 * in place — no modal. Used for actions with real consequences (ban,
 * deactivate) where a misclick shouldn't immediately take effect.
 */
export function ConfirmButton({
  onConfirm,
  confirmLabel = 'Sure?',
  children,
  variant = 'danger',
  size = 'sm',
  disabled,
  className,
}: {
  onConfirm: () => void;
  confirmLabel?: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs text-zinc-500">{confirmLabel}</span>
        <Button
          type="button"
          size={size}
          variant={variant}
          disabled={disabled}
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
        >
          Confirm
        </Button>
        <Button type="button" size={size} variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={disabled}
      className={className}
      onClick={() => setConfirming(true)}
    >
      {children}
    </Button>
  );
}
