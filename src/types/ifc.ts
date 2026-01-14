// IFC Entity Types
export type IFCEntityType = 
  | 'IFCPROJECT' | 'IFCSITE' | 'IFCBUILDING' | 'IFCBUILDINGSTOREY' | 'IFCSPACE'
  | 'IFCWALL' | 'IFCDOOR' | 'IFCWINDOW' | 'IFCSLAB' | 'IFCCOLUMN' | 'IFCBEAM' | 'IFCROOF'
  | 'IFCRELAGGREGATES' | 'IFCRELCONTAINEDINSPATIALSTRUCTURE' | 'IFCRELDEFINESBYPROPERTIES'
  | 'IFCPROPERTYSET' | 'IFCPROPERTYSINGLEVALUE' | 'IFCELEMENTQUANTITY'
  | 'IFCMATERIAL' | 'IFCMATERIALLAYER' | 'IFCRELASSOCIATESMATERIAL'
  | 'IFCOWNERHISTORY' | 'IFCPERSON' | 'IFCORGANIZATION' | 'IFCAPPLICATION'
  | 'IFCUNITASSIGNMENT' | 'IFCSIUNIT'
  | string;

// Node categories for visual hierarchy
export type NodeCategory = 'structural' | 'relationship' | 'metadata';

export interface IFCEntity {
  id: string;
  type: IFCEntityType;
  name?: string;
  attributes: Record<string, unknown>;
  isMetadata: boolean;
  category: NodeCategory;
}

export interface IFCRelationship {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  label: string;
}

export interface ParsedIFC {
  entities: IFCEntity[];
  relationships: IFCRelationship[];
}

// Relationship type mappings for edge labels
export const RELATIONSHIP_LABELS: Record<string, string> = {
  'IFCRELAGGREGATES': 'aggregates',
  'IFCRELCONTAINEDINSPATIALSTRUCTURE': 'contains',
  'IFCRELDEFINESBYPROPERTIES': 'defines properties',
  'IFCRELASSOCIATESMATERIAL': 'has material',
  'IFCRELVOIDSELEMENT': 'voids',
  'IFCRELFILLSELEMENT': 'fills',
  'IFCRELSPACEBOUNDARY': 'bounds',
  'IFCRELCONNECTSELEMENTS': 'connects',
  'IFCRELDEFINESBYTYPE': 'defines type',
};

// Entity category classification
export const STRUCTURAL_ENTITIES = new Set([
  'IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCSPACE',
  'IFCWALL', 'IFCDOOR', 'IFCWINDOW', 'IFCSLAB', 'IFCCOLUMN', 'IFCBEAM', 'IFCROOF',
  'IFCSTAIR', 'IFCRAMP', 'IFCRAILING', 'IFCFURNISHINGELEMENT', 'IFCCOVERING',
  'IFCWALLSTANDARDCASE', 'IFCSLABSTANDARDCASE', 'IFCOPENINGELEMENT',
]);

export const RELATIONSHIP_ENTITIES = new Set([
  'IFCRELAGGREGATES', 'IFCRELCONTAINEDINSPATIALSTRUCTURE', 'IFCRELDEFINESBYPROPERTIES',
  'IFCRELASSOCIATESMATERIAL', 'IFCRELVOIDSELEMENT', 'IFCRELFILLSELEMENT',
  'IFCRELSPACEBOUNDARY', 'IFCRELCONNECTSELEMENTS', 'IFCRELDEFINESBYTYPE',
]);

export const METADATA_ENTITIES = new Set([
  'IFCPROPERTYSET', 'IFCPROPERTYSINGLEVALUE', 'IFCELEMENTQUANTITY',
  'IFCMATERIAL', 'IFCMATERIALLAYER', 'IFCMATERIALLAYERSET',
  'IFCOWNERHISTORY', 'IFCPERSON', 'IFCORGANIZATION', 'IFCAPPLICATION',
  'IFCUNITASSIGNMENT', 'IFCSIUNIT', 'IFCQUANTITYLENGTH', 'IFCQUANTITYAREA',
  'IFCCLASSIFICATIONREFERENCE', 'IFCCLASSIFICATION',
]);

export function getEntityCategory(type: string): NodeCategory {
  const upperType = type.toUpperCase();
  if (STRUCTURAL_ENTITIES.has(upperType)) return 'structural';
  if (RELATIONSHIP_ENTITIES.has(upperType)) return 'relationship';
  return 'metadata';
}

export function isMetadataEntity(type: string): boolean {
  return METADATA_ENTITIES.has(type.toUpperCase());
}
