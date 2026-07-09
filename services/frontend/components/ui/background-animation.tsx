"use client";

export function BackgroundAnimation() {
  return (
    <div aria-hidden className="bg-animation pointer-events-none fixed inset-0 overflow-hidden">
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <div className="bg-blob bg-blob-3" />
    </div>
  );
}
