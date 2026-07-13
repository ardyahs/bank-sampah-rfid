import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#16a34a",
        "primary-dark": "#15803d",
        "primary-light": "#22c55e",
        leaf: "#4ade80",
        forest: "#14532d",
      },
      boxShadow: {
        eco: "0 10px 30px -12px rgba(22, 163, 74, 0.25)",
        "eco-sm": "0 4px 14px -6px rgba(22, 163, 74, 0.2)",
      },
      fontFamily: {
        sans: [
          "'Segoe UI'",
          "system-ui",
          "-apple-system",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
