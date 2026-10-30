// Apply appearance before the first paint, including while modules load.
try {
  const saved = localStorage.getItem("theme");
  document.documentElement.dataset.theme =
    saved === "dark" ||
    (!saved && matchMedia("(prefers-color-scheme: dark)").matches)
      ? "dark"
      : "light";
} catch {
  document.documentElement.dataset.theme = matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches
    ? "dark"
    : "light";
}
