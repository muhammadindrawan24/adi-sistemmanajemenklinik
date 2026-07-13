'use client';

import { cn } from '@/lib/utils';
import { AnimatedCounter } from './animated-counter';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  iconClassName?: string;
}

function StatCard({
  icon,
  label,
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  trend,
  className,
  iconClassName,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <div className="mt-2 flex items-baseline gap-1">
            <AnimatedCounter
              value={value}
              prefix={prefix}
              suffix={suffix}
              decimals={decimals}
              className="text-3xl font-bold text-slate-900"
            />
          </div>
          {trend && (
            <div
              className={cn(
                'mt-3 flex items-center gap-1 text-sm font-medium',
                trend.isPositive ? 'text-green-600' : trend.value === 0 ? 'text-slate-500' : 'text-red-600'
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : trend.value === 0 ? (
                <Minus className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>
                {trend.isPositive ? '+' : ''}
                {trend.value}%
              </span>
              <span className="text-slate-400">dari bulan lalu</span>
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-600',
            iconClassName
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export { StatCard };
export type { StatCardProps };