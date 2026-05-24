import { useEffect, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ open, title, onClose, children }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/72 p-5"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-[440px] overflow-auto rounded-xl border border-pm-border-strong bg-pm-surface px-5 py-5 font-mono text-pm-text"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2
            id="dialog-title"
            className="m-0 text-sm font-medium tracking-widest text-pm-text uppercase"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 cursor-pointer rounded-md border border-pm-border-strong bg-transparent px-2.5 py-1 text-[11px] text-pm-muted"
          >
            Close
          </button>
        </div>
        <div className="text-xs leading-relaxed text-pm-text-quaternary">{children}</div>
      </div>
    </div>
  );
}

export function DialogSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-3.5">
      <h3 className="m-0 mb-1.5 text-[11px] font-medium tracking-widest text-pm-green uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
