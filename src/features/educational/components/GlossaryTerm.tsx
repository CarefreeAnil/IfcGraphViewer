import { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BookOpen } from 'lucide-react';

// IFC Glossary - terms that confuse novice BIM practitioners
const IFC_GLOSSARY: Record<string, { definition: string; example?: string; layer?: string }> = {
  // Structural concepts
  'objectified relationship': {
    definition: 'In IFC, relationships are not simple links — they are full entities with their own attributes. This allows attaching metadata (like quantities or timestamps) to the relationship itself.',
    example: 'IfcRelContainedInSpatialStructure is an entity that stores which elements belong to which storey.',
    layer: 'Core',
  },
  'aggregation': {
    definition: 'A whole-part composition where a parent entity is made up of child entities. The children cannot exist without the parent.',
    example: 'A Building aggregates its Storeys — storeys are parts of the building.',
    layer: 'Core',
  },
  'containment': {
    definition: 'Spatial placement of elements within a spatial structure. Unlike aggregation, the element could theoretically exist elsewhere.',
    example: 'A Wall is contained in a BuildingStorey, but the wall is not a "part" of the storey.',
    layer: 'Core',
  },
  'spatial structure': {
    definition: 'The hierarchical breakdown of geographic and building location: Project → Site → Building → Storey → Space.',
    example: 'Every physical element must be placed somewhere in this hierarchy.',
    layer: 'Spatial',
  },
  'property set': {
    definition: 'A named collection of properties attached to elements via relationships. Standard sets (Pset_) ensure interoperability; custom sets allow extension.',
    example: 'Pset_WallCommon contains IsExternal, FireRating, ThermalTransmittance.',
    layer: 'Resource',
  },
  'propertyset': {
    definition: 'A named collection of properties attached to elements via relationships. Standard sets (Pset_) ensure interoperability; custom sets allow extension.',
    example: 'Pset_WallCommon contains IsExternal, FireRating, ThermalTransmittance.',
    layer: 'Resource',
  },
  'express id': {
    definition: 'A unique integer identifier assigned to each entity instance within an IFC STEP file (e.g., #42). IFC5 uses string UUIDs instead.',
    example: '#42=IFCWALL(...) — the #42 is the Express ID.',
    layer: 'Resource',
  },
  'guid': {
    definition: 'Globally Unique Identifier — a 22-character compressed string ensuring each IFC entity is globally unique across projects and software.',
    example: '2O2Fr$t4X7Z... uniquely identifies a wall across all IFC files worldwide.',
    layer: 'Core',
  },
  'globalid': {
    definition: 'Globally Unique Identifier — a 22-character compressed string ensuring each IFC entity is globally unique across projects and software.',
    example: '2O2Fr$t4X7Z... uniquely identifies a wall across all IFC files worldwide.',
    layer: 'Core',
  },
  'type object': {
    definition: 'A template that defines shared properties for multiple element instances. Reduces duplication — e.g., one door type for 50 identical doors.',
    example: 'IfcDoorType defines "Standard Interior Door" shared by all matching doors.',
    layer: 'Core',
  },
  'placement': {
    definition: 'The 3D position and orientation of an element, defined relative to its parent spatial element (local coordinates) or the project origin.',
    example: 'A wall\'s placement is relative to its storey — move the storey, the wall moves too.',
    layer: 'Resource',
  },
  'inheritance': {
    definition: 'IFC uses object-oriented inheritance: concrete entities (IfcWall) inherit attributes from abstract parents (IfcElement → IfcProduct → IfcObject → IfcRoot).',
    example: 'Every entity inherits GlobalId and Name from IfcRoot.',
    layer: 'Core',
  },
  'step file': {
    definition: 'The traditional text-based IFC file format (.ifc) using ISO 10303-21 encoding. Each line defines an entity instance with references to other entities.',
    example: '#1=IFCPROJECT(\'2O2Fr...\',#2,\'My Project\',...);',
    layer: 'Resource',
  },
  'ifc5': {
    definition: 'The next-generation IFC format using JSON and USD (Universal Scene Description) instead of STEP encoding. Uses string UUIDs instead of integer Express IDs.',
    example: '{"type": "IfcWall", "id": "abc-123-def", "attributes": {...}}',
    layer: 'Resource',
  },
  'opening element': {
    definition: 'A void cut into a building element (like a wall) to make space for a door or window. It\'s the link between the host element and the filling element.',
    example: 'Wall ←voids← IfcOpeningElement ←fills← Door',
    layer: 'Interoperability',
  },
  'quantity set': {
    definition: 'A standardized set of measured quantities (area, volume, length) attached to elements. Used for cost estimation and material takeoff.',
    example: 'Qto_WallBaseQuantities contains NetSideArea, GrossVolume, Length.',
    layer: 'Resource',
  },
  'relationship': {
    definition: 'A connection between IFC entities that defines how they interact. In IFC, relationships are objectified (they are entities themselves).',
    example: 'IfcRelContainedInSpatialStructure relates elements to their spatial container.',
    layer: 'Core',
  },
  'relationships': {
    definition: 'Connections between IFC entities that define how they interact. In IFC, relationships are objectified (they are entities themselves).',
    example: 'IfcRelContainedInSpatialStructure relates elements to their spatial container.',
    layer: 'Core',
  },
  'spatial hierarchy': {
    definition: 'The tree structure organizing spaces: Project → Site → Building → Storey → Space. All physical elements must be placed within this hierarchy.',
    example: 'A wall must be contained in a BuildingStorey, which is part of a Building.',
    layer: 'Spatial',
  },
  'geometric representation': {
    definition: 'The 3D shape definition of an element, stored separately from its attributes. Can be multiple representations (e.g., simplified vs detailed).',
    example: 'A wall can have both a Box representation (for quick viewing) and a SweptSolid (detailed geometry).',
    layer: 'Resource',
  },
  'geometry': {
    definition: 'The 3D shape definition of an element, stored separately from its attributes. Can be multiple representations (e.g., simplified vs detailed).',
    example: 'A wall can have both a Box representation (for quick viewing) and a SweptSolid (detailed geometry).',
    layer: 'Resource',
  },
};

// Detect and wrap glossary terms in text
export function glossaryHighlight(text: string): ReactNode[] {
  const termKeys = Object.keys(IFC_GLOSSARY).sort((a, b) => b.length - a.length);
  const regex = new RegExp(`\\b(${termKeys.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const term = match[0];
    const entry = IFC_GLOSSARY[term.toLowerCase()];
    if (entry) {
      parts.push(
        <GlossaryTerm key={match.index} term={term} entry={entry} />
      );
    } else {
      parts.push(term);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

interface GlossaryTermProps {
  term: string;
  entry?: { definition: string; example?: string; layer?: string };
  className?: string;
}

export function GlossaryTerm({ term, entry, className }: GlossaryTermProps) {
  const glossaryEntry = entry || IFC_GLOSSARY[term.toLowerCase()];

  if (!glossaryEntry) {
    return <span>{term}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "underline decoration-dotted decoration-primary/50 underline-offset-2 cursor-help text-primary/90 hover:text-primary transition-colors",
            className
          )}
        >
          {term}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs p-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3 h-3 text-primary" />
            <span className="font-semibold text-xs">{term}</span>
            {glossaryEntry.layer && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {glossaryEntry.layer}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {glossaryEntry.definition}
          </p>
          {glossaryEntry.example && (
            <p className="text-[11px] text-foreground/70 italic border-l-2 border-primary/30 pl-2">
              {glossaryEntry.example}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export { IFC_GLOSSARY };
