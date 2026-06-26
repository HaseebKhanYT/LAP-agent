import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0e14",
        panel: "#11161f",
        "panel-2": "#161d29",
        border: "#222c3c",
        muted: "#8b97ad",
        accent: "#5b9dff",
        "accent-dim": "#2f527f",
        ok: "#3ecf8e",
        warn: "#f5a623",
        danger: "#ff5c5c",
      },
      fontFamily: {
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
