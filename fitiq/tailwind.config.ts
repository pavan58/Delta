import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#15130F", soft: "#3A3631", mute: "#6F695F" },
        bone: { DEFAULT: "#F5F1EA", deep: "#EAE3D6", line: "#DDD4C4" },
        saffron: { DEFAULT: "#C8641E", deep: "#9E4A12", soft: "#F6E3D2" },
        moss: { DEFAULT: "#4F5B3A", soft: "#E4E8DA" },
        risk: { low: "#2F7A4B", med: "#B7791F", high: "#B42318" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: { widest2: "0.22em" },
    },
  },
  plugins: [],
};
export default config;
