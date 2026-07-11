import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
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
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
