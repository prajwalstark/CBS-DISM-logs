import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-base ease-out disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 select-none',
  {
    variants: {
      variant: {
        default: 'bg-accent text-void hover:bg-[#33d4ff] shadow-[0_0_24px_-6px_rgba(0,200,255,0.7)] active:scale-[0.97]',
        secondary: 'bg-white/[0.06] text-ink border border-white/10 hover:bg-white/[0.1] hover:border-white/20 active:scale-[0.97]',
        ghost: 'text-ink-2 hover:text-ink hover:bg-white/[0.06]',
        danger: 'bg-crit/15 text-crit border border-crit/30 hover:bg-crit/25 active:scale-[0.97]',
        outline: 'border border-accent/40 text-accent hover:bg-accent/10 active:scale-[0.97]',
      },
      size: { default: 'h-9 px-4', sm: 'h-8 px-3 text-xs', lg: 'h-11 px-6 text-[15px]', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';
