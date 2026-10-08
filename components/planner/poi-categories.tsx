import { House, Signpost, Mountain, Building2, Binoculars } from "lucide-react";

export const POI_CATEGORIES = [
  { id: "refuge", label: "Refuges", singular: "Refuge", color: "#a04b22", Icon: House },
  { id: "col", label: "Cols", singular: "Col", color: "#087b78", Icon: Signpost },
  { id: "sommet", label: "Sommets", singular: "Sommet", color: "#7750a4", Icon: Mountain },
  { id: "village", label: "Villages", singular: "Village", color: "#2668b3", Icon: Building2 },
  { id: "poi", label: "Points de vue", singular: "Point de vue", color: "#b13269", Icon: Binoculars },
] as const;

export function PoiSymbol({ category }: { category: (typeof POI_CATEGORIES)[number] }) {
  const Icon = category.Icon;
  return (
    <span className={`poi-symbol poi-symbol-${category.id}`} style={{ backgroundColor: category.color }} aria-hidden="true">
      <Icon size={15} strokeWidth={2.2} />
    </span>
  );
}
