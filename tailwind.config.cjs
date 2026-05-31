/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Use variant strategy with '.dark &' to generate traditional descendant
  // selectors (.dark .class) instead of :is(.dark *) which Firefox 48 doesn't support.
  darkMode: ['variant', '.dark &'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
        '3xl': 'calc(var(--radius) + 12px)',
        '4xl': 'calc(var(--radius) + 16px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        // Liturgical theme colors — resolved via CSS custom properties.
        // Stored as "R G B" triplets so Tailwind's opacity modifiers
        // (e.g. bg-liturgy-950/20) produce valid rgb(... / <alpha-value>).
        liturgy: {
          50: 'rgb(var(--liturgy-50) / <alpha-value>)',
          100: 'rgb(var(--liturgy-100) / <alpha-value>)',
          200: 'rgb(var(--liturgy-200) / <alpha-value>)',
          300: 'rgb(var(--liturgy-300) / <alpha-value>)',
          400: 'rgb(var(--liturgy-400) / <alpha-value>)',
          500: 'rgb(var(--liturgy-500) / <alpha-value>)',
          600: 'rgb(var(--liturgy-600) / <alpha-value>)',
          700: 'rgb(var(--liturgy-700) / <alpha-value>)',
          800: 'rgb(var(--liturgy-800) / <alpha-value>)',
          900: 'rgb(var(--liturgy-900) / <alpha-value>)',
          950: 'rgb(var(--liturgy-950) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}
