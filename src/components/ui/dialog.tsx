'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextType>({
  open: false,
  onOpenChange: () => {},
});

function Dialog({ children, open: controlledOpen, onOpenChange }: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const onOpenChangeProp = onOpenChange ?? setInternalOpen;

  return (
    <DialogContext.Provider value={{ open, onOpenChange: onOpenChangeProp }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChangeProp(false)} />
          <div className="relative z-50">
            {children}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

function DialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const { onOpenChange } = React.useContext(DialogContext);
  return (
    <div className={cn(
      'relative z-50 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-xl',
      className
    )}>
      <button
        onClick={() => onOpenChange(false)}
        className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300"
      >
        <X className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100', className)} {...props} />;
}

function DialogTrigger({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const { onOpenChange } = React.useContext(DialogContext);
  return <div onClick={() => onOpenChange(true)} className="cursor-pointer">{children}</div>;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger };
