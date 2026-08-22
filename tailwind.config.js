/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Light theme (foundation) — these map to CSS custom properties set
      // in index.css, switched by a `data-theme` attribute on <html>
      // (App.tsx). Using the RGB-triplet + `<alpha-value>` pattern keeps
      // Tailwind's opacity modifiers working (e.g. `bg-surface/40`) with a
      // value that's still swappable per theme, unlike a flat hex custom
      // property. Existing hardcoded classes (`bg-black/40`, `text-white`,
      // etc.) are UNCHANGED and still render dark regardless of theme —
      // these new `surface`/`ink` tokens are additive, for use going
      // forward, not a retroactive replacement of the whole app's styling.
      colors: {
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        "ink-soft": "rgb(var(--ink-soft-rgb) / <alpha-value>)",
        edge: "rgb(var(--edge-rgb) / <alpha-value>)",
      },
    },
  },
  plugins: [],
}
