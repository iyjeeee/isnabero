/** @type {import('tailwindcss').Config} */
// Shared design tokens — apps extend this preset instead of redefining colors/spacing/shadows/fonts per
// app. Adding a new token here makes it available to every component automatically — components should
// reference these tokens (e.g. bg-success, shadow-elevated, font-display) rather than inventing one-off
// values inline.
module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // Sans: body/UI text — chosen for legibility in a data-dense business tool (tables, forms, numbers)
        sans: ["Inter", "system-ui", "sans-serif"],
        // Display: headings only — a more characterful geometric grotesk, applied via the h1-h6 base rule
        // in index.css so every heading picks it up automatically without per-component classes.
        display: ["Sora", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Semantic status/accent colors — used by StatCard, Badge, toasts, anywhere a module needs a
        // color identity without hardcoding a hex value.
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        // Sidebar chrome — deliberately its own token set, separate from the main content background.
        // Stays a dark navy surface in BOTH light and dark mode (that persistent dark chrome is the
        // point), while --background above still switches for the main content area.
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          muted: "hsl(var(--sidebar-muted))",
          accent: "hsl(var(--sidebar-accent))",
          border: "hsl(var(--sidebar-border))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        card: "0 1px 2px 0 hsl(var(--foreground) / 0.04), 0 1px 3px 0 hsl(var(--foreground) / 0.06)",
        elevated: "0 4px 12px -2px hsl(var(--foreground) / 0.08), 0 2px 4px -2px hsl(var(--foreground) / 0.05)",
        floating: "0 12px 24px -8px hsl(var(--foreground) / 0.12), 0 4px 8px -4px hsl(var(--foreground) / 0.06)",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "scale-in": { from: { opacity: 0, transform: "scale(0.96)" }, to: { opacity: 1, transform: "scale(1)" } },
        "slide-up": { from: { opacity: 0, transform: "translateY(4px)" }, to: { opacity: 1, transform: "translateY(0)" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
        "slide-up": "slide-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
