import React, {
  createContext,
  useContext,
  useId,
  useEffect,
  useRef,
  useState,
  forwardRef,
} from 'react';
import { RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('Dialog subcomponents must be used within a <Dialog />');
  }
  return context;
}

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

export function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  title,
  description,
  children,
}: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  const titleId = useId();
  const descriptionId = useId();

  return (
    <DialogContext.Provider value={{ open, setOpen, titleId, descriptionId }}>
      {children}
    </DialogContext.Provider>
  );
}

export interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const DialogTrigger = forwardRef<HTMLButtonElement, DialogTriggerProps>(function DialogTrigger(
  { children, onClick, ...props },
  ref
) {
  const { setOpen } = useDialogContext();

  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        onClick?.(e);
        setOpen(true);
      }}
      {...props}
    >
      {children}
    </button>
  );
});
DialogTrigger.displayName = 'DialogTrigger';

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const CloseIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent(
  { className = '', style, children, ...props },
  ref
) {
  const { open, setOpen, titleId, descriptionId } = useDialogContext();
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }

      if (e.key === 'Tab' && contentRef.current) {
        const focusable = contentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: SPACING.md,
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={(node) => {
          contentRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(e) => e.stopPropagation()}
        className={`fbu-dialog-panel ${className}`}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '540px',
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: RADII.md,
          boxShadow: 'var(--shadow-modal)',
          color: 'var(--text-main)',
          fontFamily: TYPOGRAPHY.fontFamily,
          boxSizing: 'border-box',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          ...style,
        }}
        {...props}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close dialog"
          style={{
            position: 'absolute',
            top: SPACING.md,
            right: SPACING.md,
            width: '28px',
            height: '28px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--text-dim)',
            borderRadius: RADII.xs,
            cursor: 'pointer',
            padding: 0,
            transition: 'color 0.15s ease',
            zIndex: 1,
          }}
        >
          <CloseIcon />
        </button>
        {children}
      </div>
    </div>
  );
});
DialogContent.displayName = 'DialogContent';

export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const DialogHeader = forwardRef<HTMLDivElement, DialogHeaderProps>(function DialogHeader(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`fbu-dialog-header ${className}`}
      style={{
        padding: `${SPACING.lg} ${SPACING.lg} ${SPACING.sm} ${SPACING.lg}`,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xs,
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
});
DialogHeader.displayName = 'DialogHeader';

export interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const DialogTitle = forwardRef<HTMLHeadingElement, DialogTitleProps>(function DialogTitle(
  { className = '', style, children, ...props },
  ref
) {
  const { titleId } = useDialogContext();
  return (
    <h2
      ref={ref}
      id={titleId}
      className={`fbu-dialog-title ${className}`}
      style={{
        margin: 0,
        fontSize: '1.25rem',
        fontWeight: TYPOGRAPHY.weights.semibold,
        letterSpacing: TYPOGRAPHY.tracking.h2,
        color: 'var(--text-main)',
        lineHeight: 1.3,
        paddingRight: '32px',
        ...style,
      }}
      {...props}
    >
      {children}
    </h2>
  );
});
DialogTitle.displayName = 'DialogTitle';

export interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const DialogDescription = forwardRef<HTMLParagraphElement, DialogDescriptionProps>(function DialogDescription(
  { className = '', style, children, ...props },
  ref
) {
  const { descriptionId } = useDialogContext();
  return (
    <p
      ref={ref}
      id={descriptionId}
      className={`fbu-dialog-description ${className}`}
      style={{
        margin: 0,
        fontSize: '0.875rem',
        color: 'var(--text-sub)',
        lineHeight: 1.4,
        ...style,
      }}
      {...props}
    >
      {children}
    </p>
  );
});
DialogDescription.displayName = 'DialogDescription';

export interface DialogBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export const DialogBody = forwardRef<HTMLDivElement, DialogBodyProps>(function DialogBody(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`fbu-dialog-body ${className}`}
      style={{
        padding: SPACING.lg,
        boxSizing: 'border-box',
        overflowY: 'auto',
        maxHeight: '65vh',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
});
DialogBody.displayName = 'DialogBody';

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const DialogFooter = forwardRef<HTMLDivElement, DialogFooterProps>(function DialogFooter(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`fbu-dialog-footer ${className}`}
      style={{
        padding: `${SPACING.md} ${SPACING.lg}`,
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: SPACING.sm,
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
});
DialogFooter.displayName = 'DialogFooter';

export interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const DialogClose = forwardRef<HTMLButtonElement, DialogCloseProps>(function DialogClose(
  { children, onClick, ...props },
  ref
) {
  const { setOpen } = useDialogContext();
  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
});
DialogClose.displayName = 'DialogClose';
