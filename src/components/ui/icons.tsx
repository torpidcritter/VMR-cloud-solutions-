import {
  ArrowRight,
  Boxes,
  Braces,
  Building2,
  CalendarCheck,
  Cloud,
  Code2,
  Compass,
  Cpu,
  Factory,
  Landmark,
  Layers,
  LifeBuoy,
  RadioTower,
  RefreshCcw,
  ShoppingBag,
  Sprout,
  Terminal,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ServiceIcon } from "@/content/services";

export const serviceIcons: Record<ServiceIcon, LucideIcon> = {
  sap: Boxes,
  java: Braces,
  python: Terminal,
  transform: RefreshCcw,
  cloud: Cloud,
  talent: Users,
  engineering: Workflow,
  support: LifeBuoy,
};

export const genericIcons: Record<string, LucideIcon> = {
  calendar: CalendarCheck,
  layers: Layers,
  compass: Compass,
  code: Code2,
  users: Users,
  sprout: Sprout,
  cpu: Cpu,
  building: Building2,
  zap: Zap,
  landmark: Landmark,
  factory: Factory,
  shopping: ShoppingBag,
  radio: RadioTower,
};

export { ArrowRight };
