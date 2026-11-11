import { GlobeVisual } from "./GlobeVisual";
import { sapAreaGroups } from "@/content/recruitment";

/** Homepage hero visual: the rotating globe, labelled with the SAP areas we recruit for. */
export function HeroVisual() {
  return <GlobeVisual items={sapAreaGroups.flatMap((g) => g.areas.map((a) => a.code))} className="max-w-[36rem]" />;
}
