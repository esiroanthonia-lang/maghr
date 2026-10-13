/** Saves text as a file in the browser (used for CSV exports). */
export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  // BOM so Excel opens UTF-8 (₦, accented names) correctly.
  const blob = new Blob(["﻿", text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
