import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic tokens — driven by CSS vars so components never hardcode slate/dark-900
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        border: "var(--border)",
        ring: "var(--ring)",

        // Brand ramps — kept for equity
        primary: {
          DEFAULT: "#14a3b8",
          50: "#eefbfc",
          100: "#d5f2f5",
          200: "#ade4eb",
          300: "#79cfdb",
          400: "#43b2c4",
          500: "#14a3b8",
          600: "#12839a",
          700: "#146a7e",
          800: "#175668",
          900: "#174858",
          950: "#092e3a",
        },
        dark: {
          DEFAULT: "#0b3d4c",
          50: "#eaf4f6",
          100: "#cde3e8",
          200: "#9bc7d0",
          300: "#68a6b3",
          400: "#3f8494",
          500: "#2c6e80",
          600: "#1c5566",
          700: "#164757",
          800: "#123847",
          900: "#0b3d4c",
          950: "#062028",
        },
        accent: {
          DEFAULT: "#ffb35c",
          50: "#fff8ef",
          100: "#ffedd4",
          200: "#ffd9a8",
          300: "#ffc071",
          400: "#ffb35c",
          500: "#fd9a2e",
          600: "#ee7d13",
          700: "#c5610e",
          800: "#9c4c12",
          900: "#7e4011",
          950: "#441f07",
        },
        // Refined neutral scale — replaces ad hoc slate-* usage
        ink: {
          50: "#f6f7f8",
          100: "#eceef0",
          200: "#d7dbdf",
          300: "#b6bdc4",
          400: "#8f98a2",
          500: "#717b86",
          600: "#5b636e",
          700: "#4b525b",
          800: "#3a3f47",
          900: "#26292e",
          950: "#17181b",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(15 23 30 / 0.04)",
        sm: "0 1px 3px 0 rgb(15 23 30 / 0.06), 0 1px 2px -1px rgb(15 23 30 / 0.04)",
        md: "0 4px 12px -2px rgb(15 23 30 / 0.08), 0 2px 6px -2px rgb(15 23 30 / 0.05)",
        lg: "0 12px 28px -6px rgb(15 23 30 / 0.12), 0 4px 10px -4px rgb(15 23 30 / 0.06)",
        xl: "0 24px 48px -12px rgb(15 23 30 / 0.16)",
        "glow-primary": "0 8px 30px -4px rgb(20 163 184 / 0.35)",
        "glow-accent": "0 8px 30px -4px rgb(253 154 46 / 0.35)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        shimmer: "shimmer 2s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        marquee: "marquee 22s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
