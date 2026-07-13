'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  startOnMount?: boolean;
}

function AnimatedCounter({
  value,
  duration = 2,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
  startOnMount = true,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!startOnMount || hasAnimated) return;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      // Ease out cubic for smooth deceleration
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(easedProgress * value);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
        setHasAnimated(true);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration, startOnMount, hasAnimated]);

  const formattedValue = displayValue.toFixed(decimals);
  const displayText = `${prefix}${formattedValue}${suffix}`;

  return (
    <span className={cn('tabular-nums', className)}>
      {displayText}
    </span>
  );
}

export { AnimatedCounter };
export type { AnimatedCounterProps };