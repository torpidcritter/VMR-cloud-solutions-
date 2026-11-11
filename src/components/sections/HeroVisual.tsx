import { GlobeVisual } from "./GlobeVisual";

/** Homepage hero visual: the rotating technology globe. */
export function HeroVisual() {
  return <GlobeVisual items={["SAP", "Java", "Python", "Cloud", "APIs", "Data"]} className="max-w-[36rem]" />;
}
