'use client';

import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300',
        success: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
        warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
        destructive: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
        secondary: 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300',
        info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={badgeVariants({ variant })} {...props} />
  );
}

export { Badge, badgeVariants };
