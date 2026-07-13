'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'circular' | 'rectangular' | 'text';
  width?: string | number;
  height?: string | number;
}

function Skeleton({
  className,
  variant = 'default',
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  const variantClasses = {
    default: 'rounded-xl',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    text: 'rounded-md',
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-gradient-to-r from-slate-200 dark:from-slate-700 via-slate-100 dark:via-slate-600 to-slate-200 dark:to-slate-700',
        'bg-[length:200%_100%] animate-[shimmer_2s_ease-in-out_infinite]',
        variantClasses[variant],
        className
      )}
      style={{
        width: width || '100%',
        height: height || '20px',
        animation: 'shimmer 2s ease-in-out infinite',
        ...style,
      }}
      {...props}
    />
  );
}

function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm',
        className
      )}
      {...props}
    >
      <div className="space-y-4">
        <Skeleton variant="circular" width={48} height={48} />
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="text" width="100%" height={16} />
        <Skeleton variant="text" width="80%" height={16} />
      </div>
    </div>
  );
}

function SkeletonTable({ rows = 5, columns = 4, className, ...props }: { rows?: number; columns?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm',
        className
      )}
      {...props}
    >
      <div className="space-y-4">
        <div className="flex space-x-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`header-${colIndex}`}
              variant="text"
              width={colIndex === 0 ? '15%' : '25%'}
              height={20}
            />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex space-x-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                variant="text"
                width={colIndex === 0 ? '15%' : '25%'}
                height={16}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonTable };