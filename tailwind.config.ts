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
        // globals.css) so opacity modifiers like `bg-background/80` work.
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

        // Navy — all typography, icons, dark surfaces (nav/footer/panel sidebar)
        navy: {
          DEFAULT: "#101B29",
          50: "#EEF1F5",
          100: "#D7DEE8",
          200: "#B0BFD1",
          300: "#8497B3",
          400: "#566E93",
          500: "#34506F",
          600: "#223C57",
          700: "#1A2E44",
          800: "#142334",
          900: "#101B29",
          950: "#0A121C",
        },
        // Teal — the one interactive color: links, active states, primary buttons.
        // Deliberately subtle/desaturated, never neon.
        teal: {
          DEFAULT: "#1D8A8B",
          50: "#EAF6F6",
          100: "#CDEBEA",
          200: "#9BD7D6",
          300: "#64BFBE",
          400: "#3AA5A5",
          500: "#1D8A8B",
          600: "#146F71",
          700: "#135A5C",
          800: "#12494B",
          900: "#123D3F",
          950: "#072224",
        },
        // Orange — rationed to discount badges / savings amounts only
        discount: {
          DEFAULT: "#DD6B0F",
          50: "#FFF3EA",
          100: "#FFE1C7",
          200: "#FFC38C",
          300: "#FFA04D",
          400: "#F3821E",
          500: "#DD6B0F",
          600: "#B8560B",
          700: "#94450C",
          800: "#78390F",
          900: "#62300F",
        },
        // Green — reserved strictly for confirmed/successful states
        success: {
          DEFAULT: "#189A57",
          50: "#EAFBF1",
          100: "#CDF5DD",
          200: "#9CE9BC",
          300: "#64D695",
          400: "#34BD73",
          500: "#189A57",
          600: "#147D48",
          700: "#12633B",
          800: "#124F31",
          900: "#114029",
        },
        // Warm-neutral scale — replaces gray/slate everywhere (text, borders, surfaces)
        stone: {
          50: "#FAFAF9",
          100: "#F4F3F1",
          200: "#E8E6E1",
          300: "#D6D3CB",
          400: "#B3AFA3",
          500: "#8C8778",
          600: "#6F6A5C",
          700: "#58544A",
          800: "#44413A",
          900: "#33312B",
          950: "#201F1B",
        },
        // Red — errors/destructive only, kept out of the discount/success palette
        danger: {
          50: "#FDF0EE",
          100: "#FADAD4",
          200: "#F2B0A5",
          300: "#E6816F",
          400: "#D65C45",
          500: "#C1432A",
          600: "#9E3521",
          700: "#7E2B1B",
          800: "#652419",
          900: "#511F16",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        input: "var(--radius-input)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(16 27 41 / 0.04)",
        sm: "0 1px 3px 0 rgb(16 27 41 / 0.06), 0 1px 2px -1px rgb(16 27 41 / 0.04)",
        card: "0 2px 8px -2px rgb(16 27 41 / 0.06), 0 1px 2px -1px rgb(16 27 41 / 0.04)",
        "card-hover": "0 16px 32px -12px rgb(16 27 41 / 0.16)",
        md: "0 8px 20px -6px rgb(16 27 41 / 0.10)",
        lg: "0 20px 40px -12px rgb(16 27 41 / 0.16)",
        xl: "0 32px 64px -16px rgb(16 27 41 / 0.22)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "pop-in": "pop-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        marquee: "marquee 24s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
