import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#f8f5ef",
        sand: "#e8ddcc",
        bronze: "#9d6b3b",
        charcoal: "#2f2a23",
        mist: "#f0ece4",
      },
      fontFamily: {
        display: ["Poppins", "ui-sans-serif", "system-ui"],
        body: ["Nunito Sans", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        card: "0 10px 35px rgba(86, 68, 47, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;

