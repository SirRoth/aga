import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function bytesToHuman(bytes: number | null | undefined) {
  const value = Number(bytes ?? 0);
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function isWithinActiveWindow(startAt: string | null) {
  if (!startAt) return false;
  const expiresAt = new Date(startAt);
  expiresAt.setDate(expiresAt.getDate() + 7);
  return Date.now() <= expiresAt.getTime();
}

export function isOlderThanDays(startAt: string | null, days: number) {
  if (!startAt) return false;
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return new Date(startAt) < threshold;
}
