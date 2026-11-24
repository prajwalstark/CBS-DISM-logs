import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-white/10 transition-colors duration-base data-[state=checked]:bg-accent/80 data-[state=unchecked]:bg-white/10 disabled:opacity-40',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-base ease-spring data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5" />
    </SwitchPrimitive.Root>
  ),
);
Switch.displayName = 'Switch';
