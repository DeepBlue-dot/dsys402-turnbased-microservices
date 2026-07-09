"use client";

export function BackgroundGrid() {
  return (
    <div aria-hidden className="bg-grid pointer-events-none fixed inset-0">
      <div className="grid-lines" />
      <div className="grid-scan" />
      <div className="grid-sparkles" />
    </div>
  );
}
