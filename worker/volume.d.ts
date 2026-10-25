import type { Design, Place, Coordinate } from "../src/types";
export const SITE_STARTS: Record<string, number[]>;
export function toLocal(point: Coordinate, origin: Coordinate): Coordinate;
export function toLngLat(point: Coordinate, origin: Coordinate): Coordinate;
export function centerOf(points: Coordinate[]): Coordinate;
export function areaOf(points: Coordinate[]): number;
export function templateAt(
  origin: Coordinate,
  width?: number,
  depth?: number,
  kind?: string,
  bearing?: number,
): Coordinate[];
export function defaultDesign(place: Place): Design;
export function transformDesign(
  design: Design,
  transform: { scale?: number; angle?: number; east?: number; north?: number },
): Design;
export function validateDesign(input: unknown, place: Place): Design;
export function designSummary(design?: Design): string;
