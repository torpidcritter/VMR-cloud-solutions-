import { GlobeVisual } from "./GlobeVisual";

/** Homepage hero visual: the rotating technology globe. */
export function HeroVisual() {
  return <GlobeVisual items={["SAP", "Java", "Python", "Cloud", "APIs", "Data", "ERP", "Microservices", "DevOps", "Integration", "Automation", "Testing", "Analytics", "Security"]} className="max-w-[36rem]" />;
}
