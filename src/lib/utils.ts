import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isNetworkError(error: string | null | undefined, isOnline: boolean): boolean {
  if (isOnline === false) return true;
  if (!error) return false;
  const msg = error.toLowerCase();
  return (
    msg.includes("error sending request") ||
    msg.includes("failed to fetch") ||
    msg.includes("network error") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("dns") ||
    msg.includes("unreachable") ||
    msg.includes("connection") ||
    msg.includes("offline")
  );
}

export function fetchWithTimeout<T>(promise: Promise<T>, ms = 35000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Request timed out. VTOP server took too long to respond.")), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}
