import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { backendOrigin } from "./api"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAvatarUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const base = backendOrigin.replace(/\/$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}
