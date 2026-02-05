import { MS } from "./constants.ts";

type TimeUnit = keyof typeof MS;

/**
 * Adds a duration to a date
 */
export function addTime(date: Date, amount: number, unit: TimeUnit): Date {
  return new Date(date.getTime() + amount * MS[unit]);
}

/**
 * Adds time from now
 */
export function fromNow(amount: number, unit: TimeUnit): Date {
  return addTime(new Date(), amount, unit);
}

/**
 * Subtracts a duration from a date
 */
export function subtractTime(date: Date, amount: number, unit: TimeUnit): Date {
  return new Date(date.getTime() - amount * MS[unit]);
}

/**
 * Checks if a date is in the past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Checks if a date is in the future
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Gets the difference between two dates in the specified unit
 */
export function diffIn(unit: TimeUnit, date1: Date, date2: Date): number {
  return Math.abs(date1.getTime() - date2.getTime()) / MS[unit];
}
