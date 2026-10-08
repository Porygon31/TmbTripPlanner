"use client";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { POI_CATEGORIES, PoiSymbol } from "./poi-categories";

export default function PoiLegend({ layers, onChange, expanded, onToggle }: {
  layers: string[];
  onChange: (id: string, visible: boolean) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="poi-legend" data-tour="poi" aria-label="Légende des points d’intérêt">
      <button className="poi-legend-heading" onClick={onToggle} aria-expanded={expanded} aria-controls="poi-legend-layers">
        <Layers size={16} aria-hidden="true" />
        <span>Points d’intérêt</span>
        {expanded ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}
      </button>
      <div id="poi-legend-layers" hidden={!expanded}>
        <div className="poi-legend-items">
          {POI_CATEGORIES.map(category => (
            <label key={category.id} className="poi-legend-item">
              <PoiSymbol category={category} />
              <span>{category.label}</span>
              <Checkbox checked={layers.includes(category.id)} onCheckedChange={checked => onChange(category.id, checked === true)} />
            </label>
          ))}
        </div>
        <p>Extrait OSM non exhaustif</p>
      </div>
    </section>
  );
}
