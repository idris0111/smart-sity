import { useSyncExternalStore } from "react";

/** @type {Record<string, {hue: number, color: string}>} */
export const ACCENTS = {
  blue: { hue: 204, color: "#72c9ff" },
  red: { hue: 348, color: "#ff728e" },
  green: { hue: 155, color: "#72ffbf" },
};
const KEY = "smart-city-accent";
let accent = "blue";
try {
  const saved = localStorage.getItem(KEY);
  if (Object.hasOwn(ACCENTS, saved)) accent = saved;
} catch {
  /* Storage can be unavailable in private browsers. */
}
const listeners = new Set();
function apply() {
  if (typeof document !== "undefined")
    document.documentElement.dataset.accent = accent;
}
apply();
export function setAccent(value) {
  if (!Object.hasOwn(ACCENTS, value)) return;
  accent = value;
  apply();
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* Keep the in-memory choice. */
  }
  listeners.forEach((listener) => listener());
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY && event.key !== null) return;
    accent = Object.hasOwn(ACCENTS, event.newValue) ? event.newValue : "blue";
    apply();
    listeners.forEach((listener) => listener());
  });
export function useAccent() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => accent,
    () => "blue",
  );
}
