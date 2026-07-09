"use client";

import { useEffect } from "react";

export function BackgroundGrid() {
  useEffect(() => {
    const canvas = document.getElementById("grid-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouse = { x: -9999, y: -9999 };
    const squareSize = 80;
    const grid: Array<{ x: number; y: number; alpha: number; fading: boolean; lastTouched: number }> = [];

    function initGrid() {
      grid.length = 0;
      for (let x = 0; x < width; x += squareSize) {
        for (let y = 0; y < height; y += squareSize) {
          grid.push({ x, y, alpha: 0, fading: false, lastTouched: 0 });
        }
      }
    }

    function getCellAt(x: number, y: number) {
      return grid.find((cell) => x >= cell.x && x < cell.x + squareSize && y >= cell.y && y < cell.y + squareSize);
    }

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initGrid();
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;

      const cell = getCellAt(mouse.x, mouse.y);
      if (cell && cell.alpha === 0) {
        cell.alpha = 1;
        cell.lastTouched = Date.now();
        cell.fading = false;
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    function drawGrid() {
      ctx.clearRect(0, 0, width, height);
      const now = Date.now();

      for (let i = 0; i < grid.length; i += 1) {
        const cell = grid[i];

        if (cell.alpha > 0 && !cell.fading && now - cell.lastTouched > 500) {
          cell.fading = true;
        }

        if (cell.fading) {
          cell.alpha -= 0.02;
          if (cell.alpha <= 0) {
            cell.alpha = 0;
            cell.fading = false;
          }
        }

        if (cell.alpha > 0) {
          const centerX = cell.x + squareSize / 2;
          const centerY = cell.y + squareSize / 2;
          const gradient = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, squareSize);
          gradient.addColorStop(0, `rgba(0, 255, 204, ${cell.alpha})`);
          gradient.addColorStop(1, `rgba(0, 255, 204, 0)`);

          ctx.strokeStyle = gradient;
          ctx.lineWidth = 1.3;
          ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, squareSize - 1, squareSize - 1);
        }
      }

      requestAnimationFrame(drawGrid);
    }

    initGrid();
    drawGrid();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return null;
}
