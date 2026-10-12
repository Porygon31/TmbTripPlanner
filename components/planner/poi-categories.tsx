import { House, Signpost, Mountain, Building2, Binoculars, Flag, BedDouble } from "lucide-react";

export const TMB_START_POI_ID = "node/1744277791";

export const POI_CATEGORIES = [
  { id: "start", label: "Les Houches", singular: "Départ du TMB classique", color: "#b45125", Icon: Flag },
  { id: "refuge", label: "Refuges", singular: "Refuge", color: "#a04b22", Icon: House },
  { id: "hotel", label: "Hôtels", singular: "Hôtel", color: "#a87808", Icon: BedDouble },
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
