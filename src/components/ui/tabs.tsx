import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List ref={ref} className={cn('inline-flex items-center gap-1 rounded-xl glass p-1', className)} {...props} />
  ),
);
TabsList.displayName = 'TabsList';

export const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-2 transition-all duration-base hover:text-ink data-[state=active]:bg-accent/15 data-[state=active]:text-accent data-[state=active]:shadow-[inset_0_0_0_1px_rgba(0,200,255,0.3)] [&_svg]:size-3.5',
        className,
      )}
      {...props}
    />
  ),
);
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  ({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} className={cn('mt-4 focus-visible:outline-none', className)} {...props} />,
);
TabsContent.displayName = 'TabsContent';
