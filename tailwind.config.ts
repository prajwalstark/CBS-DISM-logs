import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        // Design tokens — mirrored in src/design/tokens.ts for WebGL use.
        void: { DEFAULT: '#050810', 2: '#0A1020', 3: '#0F182E' },
        accent: { DEFAULT: '#00C8FF', 2: '#7067FF' },
        ok: '#00E6A0',
        warn: '#FFB547',
        crit: '#FF4568',
        ink: { DEFAULT: '#E6EDF7', 2: '#9AA8C2', 3: '#64728C' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 4px)', sm: 'calc(var(--radius) - 8px)', xl: 'calc(var(--radius) + 4px)', '2xl': 'calc(var(--radius) + 10px)' },
      transitionTimingFunction: { out: 'cubic-bezier(0.22, 1, 0.36, 1)', spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
      transitionDuration: { fast: '150ms', base: '250ms', slow: '450ms' },
      boxShadow: {
        glass: '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 20px 50px -20px rgba(0,0,0,0.7)',
        glow: '0 0 0 1px rgba(0,200,255,0.35), 0 0 30px -6px rgba(0,200,255,0.45)',
      },
      keyframes: {
        'pulse-ring': { '0%': { transform: 'scale(0.9)', opacity: '0.8' }, '100%': { transform: 'scale(1.8)', opacity: '0' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.22,1,0.36,1) infinite',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
