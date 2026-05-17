import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#10131a",
          dim: "#10131a",
          bright: "#363941",
          container: {
            lowest: "#0b0e15",
            low: "#191b23",
            DEFAULT: "#1d2027",
            high: "#272a31",
            highest: "#32353c",
          },
        },
        "on-surface": {
          DEFAULT: "#e1e2ec",
          variant: "#c2c6d6",
        },
        primary: {
          DEFAULT: "#adc6ff",
          on: "#002e6a",
          container: "#4d8eff",
          "on-container": "#00285d",
        },
        secondary: {
          DEFAULT: "#b9c8de",
          on: "#233143",
          container: "#39485a",
          "on-container": "#a7b6cc",
        },
        tertiary: {
          DEFAULT: "#ffb786",
          on: "#502400",
          container: "#df7412",
          "on-container": "#461f00",
        },
        error: {
          DEFAULT: "#ffb4ab",
          on: "#690005",
          container: "#93000a",
          "on-container": "#ffdad6",
        },
        positive: "#10B981",
        critical: "#F59E0B",
      },
      fontFamily: {
        geist: ["Geist", "sans-serif"],
        mono: ["Geist", "monospace"],
      },
      fontSize: {
        "display-lg": ["32px", { lineHeight: "1.2", fontWeight: "600", letterSpacing: "-0.02em" }],
        "headline-md": ["20px", { lineHeight: "1.4", fontWeight: "600", letterSpacing: "-0.01em" }],
        "body-md": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "1.4", fontWeight: "400" }],
        "label-caps": ["11px", { lineHeight: "1", fontWeight: "700", letterSpacing: "0.05em" }],
        "data-mono": ["14px", { lineHeight: "1", fontWeight: "500" }],
      },
      borderRadius: {
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      spacing: {
        base: "4px",
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        gutter: "12px",
        "container-margin": "16px",
      },
    },
  },
  plugins: [],
};

export default config;
