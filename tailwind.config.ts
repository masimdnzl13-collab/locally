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
        // Semantic tokens — driven by CSS vars (stored as "R G B" triplets in
        // globals.css) so opacity modifiers like `bg-background/95` work.
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        border: "rgb(var(--border) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        brick: "rgb(var(--brick) / <alpha-value>)",

        // Turquoise — primary interaction color (links, buttons, active states)
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
        // Petrol ink — headlines, body copy, "mürekkep" blocks. Never a page ground.
        ink: {
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
        // Alias of `ink` kept for existing call-sites (identical ramp) — prefer `ink` in new code
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
        // Warm orange — rationed: today's price, flash urgency, primary CTAs only
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
        // Sand — warm kum/bej ara tonu, section grounds and ticket-stub fills
        sand: {
          50: "#fbf7ee",
          100: "#f6eedc",
          200: "#eee0c2",
          300: "#e2cda0",
          400: "#d2b378",
          500: "#be9757",
          600: "#9c7a42",
          700: "#7c6236",
          800: "#63502f",
          900: "#4f4128",
          950: "#2c2415",
        },
        // Sepia — warm neutral scale replacing cool grays for muted text/borders
        sepia: {
          50: "#f8f5f0",
          100: "#efe9df",
          200: "#e1d8c8",
          300: "#c9bca4",
          400: "#a99a7e",
          500: "#8c7c60",
          600: "#6f6249",
          700: "#59503b",
          800: "#453e2e",
          900: "#302b20",
          950: "#1c1913",
        },
        // Tuğla — warm alert/danger tone (never a raw red)
        tile: {
          50: "#fdf1ee",
          100: "#f9dcd3",
          200: "#f0b5a3",
          300: "#e3876b",
          400: "#d1633f",
          500: "#b8492a",
          600: "#9a3b21",
          700: "#7c301c",
          800: "#602619",
          900: "#4c1f16",
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
        // Depth comes from ground-tone + hairline borders, not shadow. These
        // exist only for true overlays that must visually detach (menus, modals).
        xs: "0 1px 2px 0 rgb(11 61 76 / 0.05)",
        sm: "0 1px 2px 0 rgb(11 61 76 / 0.06)",
        md: "0 4px 12px -4px rgb(11 61 76 / 0.10)",
        lg: "0 12px 28px -8px rgb(11 61 76 / 0.14)",
        xl: "0 24px 48px -16px rgb(11 61 76 / 0.18)",
        "glow-primary": "0 6px 20px -6px rgb(20 163 184 / 0.35)",
        "glow-accent": "0 6px 20px -6px rgb(253 154 46 / 0.4)",
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
