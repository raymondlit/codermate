import { useEffect, useSyncExternalStore } from "react";

export type ThemeMode = "paper" | "warm" | "ink" | "pure";
export type AccentKey = "indigo" | "vermilion" | "pine" | "rose" | "charcoal";
export type FontKey = "sans" | "serif" | "mono" | "rounded";
export type DensityKey = "compact" | "cozy" | "comfortable";

export type Appearance = {
  theme: ThemeMode;
  accent: AccentKey;
  font: FontKey;
  fontSize: number; // 13-19 px
  radius: number; // 0 - 1 rem
  density: DensityKey;
};

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "paper",
  accent: "indigo",
  font: "sans",
  fontSize: 15,
  radius: 0.25,
  density: "cozy",
};

const STORAGE_KEY = "codementor:appearance";

// ---- Tokens ----
const THEMES: Record<ThemeMode, { bg: string; surface: string; fg: string; card: string; muted: string; mutedFg: string; border: string; borderStrong: string; dark: boolean }> = {
  paper: {
    bg: "oklch(0.985 0.005 85)", surface: "oklch(0.975 0.006 85)",
    fg: "oklch(0.22 0.005 270)", card: "oklch(1 0 0)",
    muted: "oklch(0.95 0.005 85)", mutedFg: "oklch(0.55 0.008 270)",
    border: "oklch(0.91 0.006 85)", borderStrong: "oklch(0.85 0.008 85)", dark: false,
  },
  warm: {
    bg: "oklch(0.96 0.015 75)", surface: "oklch(0.95 0.018 75)",
    fg: "oklch(0.25 0.02 50)", card: "oklch(0.985 0.01 75)",
    muted: "oklch(0.93 0.018 75)", mutedFg: "oklch(0.5 0.02 50)",
    border: "oklch(0.88 0.02 75)", borderStrong: "oklch(0.8 0.025 75)", dark: false,
  },
  pure: {
    bg: "oklch(1 0 0)", surface: "oklch(0.99 0 0)",
    fg: "oklch(0.18 0 0)", card: "oklch(1 0 0)",
    muted: "oklch(0.96 0 0)", mutedFg: "oklch(0.5 0 0)",
    border: "oklch(0.92 0 0)", borderStrong: "oklch(0.85 0 0)", dark: false,
  },
  ink: {
    bg: "oklch(0.18 0.005 270)", surface: "oklch(0.22 0.005 270)",
    fg: "oklch(0.95 0.005 85)", card: "oklch(0.22 0.005 270)",
    muted: "oklch(0.26 0.005 270)", mutedFg: "oklch(0.65 0.008 270)",
    border: "oklch(1 0 0 / 12%)", borderStrong: "oklch(1 0 0 / 20%)", dark: true,
  },
};

const ACCENTS: Record<AccentKey, { primary: string; primaryFg: string; ring: string; label: string; swatch: string }> = {
  indigo:    { primary: "oklch(0.32 0.045 250)", primaryFg: "oklch(0.985 0.005 85)", ring: "oklch(0.32 0.045 250)", label: "墨蓝",  swatch: "#1F3A5F" },
  vermilion: { primary: "oklch(0.55 0.16 30)",   primaryFg: "oklch(0.985 0.005 85)", ring: "oklch(0.55 0.16 30)",   label: "朱砂",  swatch: "#C0392B" },
  pine:      { primary: "oklch(0.42 0.08 155)",  primaryFg: "oklch(0.985 0.005 85)", ring: "oklch(0.42 0.08 155)",  label: "松绿",  swatch: "#2F5D4E" },
  rose:      { primary: "oklch(0.5 0.09 350)",   primaryFg: "oklch(0.985 0.005 85)", ring: "oklch(0.5 0.09 350)",   label: "紫檀",  swatch: "#7E3C5D" },
  charcoal:  { primary: "oklch(0.28 0.005 270)", primaryFg: "oklch(0.985 0.005 85)", ring: "oklch(0.28 0.005 270)", label: "炭灰",  swatch: "#2B2B2B" },
};

const FONTS: Record<FontKey, { stack: string; label: string }> = {
  sans:    { stack: '"Inter", "Noto Sans SC", system-ui, sans-serif', label: "无衬线" },
  serif:   { stack: '"Noto Serif SC", "Songti SC", "SimSun", Georgia, serif', label: "衬线" },
  mono:    { stack: '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace', label: "等宽" },
  rounded: { stack: '"Hiragino Maru Gothic ProN", "Quicksand", "Inter", system-ui, sans-serif', label: "圆体" },
};

const DENSITY_SCALE: Record<DensityKey, string> = {
  compact: "0.9",
  cozy: "1",
  comfortable: "1.1",
};

export const APPEARANCE_OPTIONS = {
  themes: [
    { key: "paper" as const, label: "米白" },
    { key: "warm" as const, label: "暖纸" },
    { key: "pure" as const, label: "极白" },
    { key: "ink" as const, label: "墨黑" },
  ],
  accents: (Object.keys(ACCENTS) as AccentKey[]).map((k) => ({ key: k, label: ACCENTS[k].label, swatch: ACCENTS[k].swatch })),
  fonts: (Object.keys(FONTS) as FontKey[]).map((k) => ({ key: k, label: FONTS[k].label, stack: FONTS[k].stack })),
  densities: [
    { key: "compact" as const, label: "紧凑" },
    { key: "cozy" as const, label: "标准" },
    { key: "comfortable" as const, label: "宽松" },
  ],
};

// ---- Apply ----
export function applyAppearance(a: Appearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const t = THEMES[a.theme];
  const ac = ACCENTS[a.accent];
  const font = FONTS[a.font];

  root.classList.toggle("dark", t.dark);

  const set = (k: string, v: string) => root.style.setProperty(k, v);
  set("--background", t.bg);
  set("--surface", t.surface);
  set("--foreground", t.fg);
  set("--card", t.card);
  set("--card-foreground", t.fg);
  set("--popover", t.card);
  set("--popover-foreground", t.fg);
  set("--muted", t.muted);
  set("--muted-foreground", t.mutedFg);
  set("--accent", t.muted);
  set("--accent-foreground", t.fg);
  set("--secondary", t.muted);
  set("--secondary-foreground", t.fg);
  set("--border", t.border);
  set("--border-strong", t.borderStrong);
  set("--input", t.border);
  set("--sidebar", t.bg);
  set("--sidebar-foreground", t.fg);
  set("--sidebar-accent", t.muted);
  set("--sidebar-accent-foreground", t.fg);
  set("--sidebar-border", t.border);

  set("--primary", ac.primary);
  set("--primary-foreground", ac.primaryFg);
  set("--ring", ac.ring);
  set("--sidebar-primary", ac.primary);
  set("--sidebar-primary-foreground", ac.primaryFg);
  set("--sidebar-ring", ac.ring);
  set("--chart-1", ac.primary);

  set("--radius", `${a.radius}rem`);
  set("font-size", `${a.fontSize}px`);
  set("--app-density", DENSITY_SCALE[a.density]);
  document.body && (document.body.style.fontFamily = font.stack);
  root.style.setProperty("--font-sans", font.stack);
}

// ---- Store ----
let current: Appearance = DEFAULT_APPEARANCE;
const listeners = new Set<() => void>();

function load(): Appearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function persist(a: Appearance) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch {
    /* ignore */
  }
}

export function getAppearance(): Appearance {
  return current;
}

export function setAppearance(patch: Partial<Appearance>) {
  current = { ...current, ...patch };
  applyAppearance(current);
  persist(current);
  listeners.forEach((l) => l());
}

export function resetAppearance() {
  current = { ...DEFAULT_APPEARANCE };
  applyAppearance(current);
  persist(current);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAppearance(): Appearance {
  const snap = useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULT_APPEARANCE,
  );
  return snap;
}

export function useAppearanceBootstrap() {
  useEffect(() => {
    current = load();
    applyAppearance(current);
    listeners.forEach((l) => l());
  }, []);
}
