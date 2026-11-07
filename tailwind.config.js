/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1a1a1a",
        inkSoft: "#6b7280",
        surface: "#ffffff",
        line: "#e5e7eb",
        brand: "#0d9488",
        brandSoft: "#f0fdfa",
        // Publieke site (publito.nl): de kleuren uit het Publito-logo.
        pub: {
          // Titels en donkere tekst: warm antraciet (geen zwart, geen groen).
          ink: "#2b2a26",
          // Donkergroen uit het logo, alleen nog voor kleine accenten.
          forest: "#053b30",
          green: "#106d52",
          greenDark: "#0b5a43",
          leaf: "#378c69",
          cream: "#f9f4ec",
          sand: "#efe4d4",
          sandLine: "#e3d3bd",
          sandInk: "#4a3f2e",
          mint: "#e7f2ec",
          line: "#e4e8e5",
          soft: "#5f6f69",
          body: "#1b2a25",
          // Lichtgrijze secties (variant A) en de zandkleurige footer.
          mist: "#f5f6f5",
          mistLine: "#e9ebe9",
          stone: "#f0efea",
          stoneLine: "#e1dfd7",
          zand: "#f3eee4",
          zandLine: "#e3d9c8",
          zandInk: "#5c554a",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
        // Publieke site: Inter (zelf gehost via next/font/local in (public)/layout).
        inter: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
