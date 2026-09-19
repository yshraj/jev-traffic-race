import {
  Barricade,
  Bus,
  Cow,
  Dog,
  Drop,
  Motorcycle,
  PersonSimpleWalk,
  TrafficCone,
  Truck,
  Van,
} from "@phosphor-icons/react/dist/ssr";
import type { ComponentType } from "react";
import type { HazardId } from "@/lib/types";

type GlyphProps = {
  size?: number;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  className?: string;
  "aria-hidden"?: boolean;
};

export type HazardSpec = {
  label: string;
  /** `patch` draws a shape on the road surface, `glyph` draws an icon. */
  shape: "patch" | "glyph";
  Glyph?: ComponentType<GlyphProps>;
};

export const HAZARDS: Record<HazardId, HazardSpec> = {
  pothole: { label: "pothole", shape: "patch" },
  shadow: { label: "shadow", shape: "patch" },
  bag: { label: "plastic bag", shape: "patch" },
  cement: { label: "wet cement", shape: "glyph", Glyph: Drop },
  rickshaw: { label: "auto rickshaw", shape: "glyph", Glyph: Van },
  truck: { label: "truck", shape: "glyph", Glyph: Truck },
  bus: { label: "bus", shape: "glyph", Glyph: Bus },
  bike: { label: "motorbike", shape: "glyph", Glyph: Motorcycle },
  cow: { label: "cow", shape: "glyph", Glyph: Cow },
  dog: { label: "dog", shape: "glyph", Glyph: Dog },
  pedestrian: { label: "pedestrian", shape: "glyph", Glyph: PersonSimpleWalk },
  cone: { label: "cone", shape: "glyph", Glyph: TrafficCone },
  barricade: { label: "barricade", shape: "glyph", Glyph: Barricade },
};

export function hazardSpec(id: HazardId): HazardSpec {
  return HAZARDS[id];
}
