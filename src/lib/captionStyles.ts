import type { CSSProperties } from "react";

// Caption style presets for the Social section's video editor. Each preset
// is a real, renderable style — used both for the live CSS preview overlay
// (VideoEditorModal.tsx, via Google Fonts <link> + captionStyleToCss) and
// for the actual burned-in export via ffmpeg's drawtext filter
// (videoEditor.ts's buildDrawtextFilter, via fontFileUrl). Keeping ONE
// source of truth per preset is what guarantees the preview actually
// matches the export instead of silently drifting apart.
//
// fontFileUrl points at a real static (non-variable) TTF via jsDelivr's
// mirror of the google/fonts GitHub repo (confirmed CORS-enabled, unlike
// raw.githubusercontent.com, and confirmed to 200 for each path below) —
// ffmpeg's drawtext needs an actual font FILE on its virtual filesystem,
// not a CSS @font-face reference, and FreeType (which drawtext uses) can't
// reliably pick a weight out of a variable font, so every style here uses a
// font that ships a real static file for the weight it wants.
export type CaptionStyle = {
  id: string;
  name: string;
  description: string;
  cssFamily: string; // Google Fonts family name, exactly as it appears in the fonts.googleapis.com URL
  fontFileUrl: string; // static TTF for ffmpeg drawtext
  fontWeight: number;
  color: string;
  strokeColor: string;
  strokeWidth: number; // px in preview; mapped to drawtext borderw
  background: string | null; // CSS background for the preview pill/box; null = none
  uppercase: boolean;
  position: "top" | "center" | "bottom";
  letterSpacing: string;
};

const JSDELIVR_FONTS = "https://cdn.jsdelivr.net/gh/google/fonts@main/";

export const CAPTION_STYLES: CaptionStyle[] = [
  {
    id: "bold-white-outline",
    name: "Bold White",
    description: "The classic — thick white text, black outline. Works on any background.",
    cssFamily: "Archivo Black",
    fontFileUrl: JSDELIVR_FONTS + "ofl/archivoblack/ArchivoBlack-Regular.ttf",
    fontWeight: 900,
    color: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 3,
    background: null,
    uppercase: true,
    position: "bottom",
    letterSpacing: "0.01em",
  },
  {
    id: "impact-yellow",
    name: "Impact Yellow",
    description: "High-energy yellow-on-black — reads instantly on a phone screen.",
    cssFamily: "Anton",
    fontFileUrl: JSDELIVR_FONTS + "ofl/anton/Anton-Regular.ttf",
    fontWeight: 400,
    color: "#ffe600",
    strokeColor: "#000000",
    strokeWidth: 3,
    background: null,
    uppercase: true,
    position: "center",
    letterSpacing: "0.01em",
  },
  {
    id: "boxed-subtitle",
    name: "Boxed Subtitle",
    description: "Clean white text on a solid dark pill — traditional, easy to read over busy footage.",
    cssFamily: "Lato",
    fontFileUrl: JSDELIVR_FONTS + "ofl/lato/Lato-Bold.ttf",
    fontWeight: 700,
    color: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 0,
    background: "rgba(0,0,0,0.72)",
    uppercase: false,
    position: "bottom",
    letterSpacing: "0",
  },
  {
    id: "minimal-clean",
    name: "Minimal Clean",
    description: "Understated white sans-serif, thin outline — for a more polished/premium feel.",
    cssFamily: "Lato",
    fontFileUrl: JSDELIVR_FONTS + "ofl/lato/Lato-Regular.ttf",
    fontWeight: 400,
    color: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 1,
    background: null,
    uppercase: false,
    position: "bottom",
    letterSpacing: "0",
  },
  {
    id: "neon-pop",
    name: "Neon Pop",
    description: "Bright red-orange condensed pop text with a heavy black outline — for hooks/CTAs.",
    cssFamily: "Bebas Neue",
    fontFileUrl: JSDELIVR_FONTS + "ofl/bebasneue/BebasNeue-Regular.ttf",
    fontWeight: 400,
    color: "#ff3d1f",
    strokeColor: "#000000",
    strokeWidth: 3,
    background: null,
    uppercase: true,
    position: "top",
    letterSpacing: "0.02em",
  },
  {
    id: "gold-premium",
    name: "Gold Premium",
    description: "Gold text on a soft dark box — for testimonial/before-after reveals.",
    cssFamily: "Poppins",
    fontFileUrl: JSDELIVR_FONTS + "ofl/poppins/Poppins-SemiBold.ttf",
    fontWeight: 600,
    color: "#f2c14e",
    strokeColor: "#1a1200",
    strokeWidth: 1,
    background: "rgba(20,15,5,0.55)",
    uppercase: false,
    position: "bottom",
    letterSpacing: "0.01em",
  },
];

export const getCaptionStyle = (id: string): CaptionStyle => CAPTION_STYLES.find(s => s.id === id) || CAPTION_STYLES[0];

// CSS for the live-preview overlay (VideoEditorModal.tsx renders one of
// these divs positioned over the <video>, swapped per active caption).
export const captionStyleToCss = (s: CaptionStyle): CSSProperties => ({
  fontFamily: `'${s.cssFamily}', sans-serif`,
  fontWeight: s.fontWeight,
  color: s.color,
  textTransform: s.uppercase ? "uppercase" : "none",
  letterSpacing: s.letterSpacing,
  background: s.background || "transparent",
  padding: s.background ? "6px 14px" : 0,
  borderRadius: s.background ? 8 : 0,
  WebkitTextStroke: s.strokeWidth > 0 ? `${s.strokeWidth}px ${s.strokeColor}` : undefined,
  textShadow: s.strokeWidth > 0
    ? [1, -1].flatMap(x => [1, -1].map(y => `${x}px ${y}px 0 ${s.strokeColor}`)).join(", ")
    : undefined,
});

// Google Fonts stylesheet URL covering every family used above, for the
// live preview only (the export path fetches fontFileUrl's TTF directly).
export const CAPTION_GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Anton&family=Lato:wght@400;700&family=Bebas+Neue&family=Poppins:wght@600&display=swap";
