/**
 * ifcSchemaRuntime.ts
 *
 * Loads the pre-generated IFC schema JSON files from /public/schemas/ and
 * resolves the full ordered STEP attribute list for any IFC entity by walking
 * its supertype inheritance chain.
 *
 * Why fetch instead of import?
 *   Vite's public/ directory is served as-is and cannot be bundled as ES
 *   modules. The schema JSONs are intentionally kept there so they are also
 *   accessible as standalone files (for debugging / external tooling).
 *
 * Usage:
 *   import { getSchemaProps, onSchemaLoad, getSchemaGeneration } from './ifcSchemaRuntime';
 */

import type { IfcPropertyDef } from './ifcSchema';

// ─── Raw types (shape of the generated JSON files) ────────────────────────────

interface RawAttr {
  name: string;
  type_name: string;
  is_optional: boolean;
  is_inverse: boolean;     // always false in these JSONs — do not rely on it
}

interface RawEntity {
  name: string;
  supertype: string | null;
  attributes: RawAttr[];
}

type RawEntities = Record<string, RawEntity>;

// ─── Attribute filter ─────────────────────────────────────────────────────────
// The generated JSONs encode inverse / relationship attributes with
// type_name "SET", derived-expression pseudo-attributes with type_names like
// "HIINDEX" / "SIZEOF" / "NOT", and uniqueness / where-rule entries with
// names matching WR<n> / UR<n>.  None of these appear in a STEP instance line.

const SKIP_TYPES = new Set([
  'SET',        // inverse relationship (e.g. HasOpenings, ContainedInStructure)
  'NOT',        // WHERE rule expression
  'SIZEOF',     // WHERE rule expression
  'HIINDEX',    // DERIVE expression
  'SELF',       // DERIVE / WHERE reference to self
  'QUERY',      // EXPRESS QUERY function
  'EXISTING',   // EXPRESS EXISTING function
]);

const RULE_NAME = /^[WU]R\d+$/; // WR1, WR2, UR1, UR2 …

function isExplicitAttr(a: RawAttr): boolean {
  return !SKIP_TYPES.has(a.type_name) && !RULE_NAME.test(a.name);
}

// ─── Resolver factory ─────────────────────────────────────────────────────────

function makeResolver(entities: RawEntities) {
  const cache = new Map<string, IfcPropertyDef[]>();

  // Case-insensitive index: lowercase key → canonical key in this schema
  // Needed because node.ifcType is always UPPERCASE (e.g. "IFCPERSON")
  // while the JSON schema uses PascalCase (e.g. "IfcPerson").
  const lowerIndex = new Map<string, string>();
  for (const key of Object.keys(entities)) {
    lowerIndex.set(key.toLowerCase(), key);
  }

  return function resolve(entityName: string): IfcPropertyDef[] {
    // Normalise to the schema's canonical casing
    const canonical = entities[entityName]
      ? entityName
      : (lowerIndex.get(entityName.toLowerCase()) ?? entityName);

    const hit = cache.get(canonical);
    if (hit) return hit;

    // Walk from the entity up to the root, prepending each level so the root's
    // attributes (GlobalId, OwnerHistory, …) come first — matching STEP order.
    const levels: RawAttr[][] = [];
    let current: string | null = canonical;
    const visited = new Set<string>();

    while (current !== null) {
      if (visited.has(current)) break; // cycle guard
      visited.add(current);
      const ent = entities[current];
      if (!ent) break;                 // entity absent from this schema version
      levels.unshift(ent.attributes);  // prepend → root attributes come first
      current = ent.supertype;
    }

    if (levels.length === 0) {
      cache.set(canonical, []);
      return [];
    }

    const result: IfcPropertyDef[] = levels
      .flat()
      .filter(isExplicitAttr)
      .map(a => ({
        name: a.name,
        type: a.type_name,
        required: !a.is_optional,
        description: a.is_optional ? `${a.type_name} — optional` : a.type_name,
      }));

    cache.set(canonical, result);
    return result;
  };
}

// ─── Module-level state ───────────────────────────────────────────────────────

let resolveIfc4:   ((n: string) => IfcPropertyDef[]) | null = null;
let resolveIfc4x3: ((n: string) => IfcPropertyDef[]) | null = null;
let resolveIfc2x3: ((n: string) => IfcPropertyDef[]) | null = null;

let _schemaGeneration = 0;
const _listeners = new Set<() => void>();

// ─── Load schemas immediately on module import ────────────────────────────────

Promise.all([
  fetch('/schemas/IFC4.json').then(r => r.json()),
  fetch('/schemas/IFC4X3.json').then(r => r.json()),
  fetch('/schemas/schema-ifc2x3.json').then(r => r.json()),
]).then(([ifc4, ifc4x3, ifc2x3]) => {
  resolveIfc4   = makeResolver(ifc4.entities   as RawEntities);
  resolveIfc4x3 = makeResolver(ifc4x3.entities as RawEntities);
  resolveIfc2x3 = makeResolver(ifc2x3.entities as RawEntities);
  _schemaGeneration += 1;
  _listeners.forEach(cb => cb());
  _listeners.clear();
}).catch(err => {
  console.warn('[ifcSchemaRuntime] Failed to load IFC schema JSONs:', err);
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Current schema generation counter — increments once when all three schemas
 * have finished loading.  Useful as a React useMemo / useEffect dependency.
 */
export function getSchemaGeneration(): number {
  return _schemaGeneration;
}

/**
 * Subscribe to schema load completion.
 * If schemas are already loaded the callback fires synchronously.
 * Returns an unsubscribe function.
 */
export function onSchemaLoad(cb: () => void): () => void {
  if (_schemaGeneration > 0) {
    cb();
    return () => { /* already fired */ };
  }
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

// ─── Static fallback for non-rooted entities absent from the schema JSONs ─────
// The generated JSON files only cover entities in the IfcRoot hierarchy.
// Ownership / actor / address entities (IfcPerson, IfcOwnerHistory, etc.) are
// standalone ENTITY types in EXPRESS that were excluded by the generator.
// Their STEP attribute order is stable across IFC2X3/IFC4/IFC4X3.

function p(name: string, type: string, optional: boolean): IfcPropertyDef {
  return { name, type, required: !optional, description: optional ? `${type} — optional` : type };
}

const STATIC_FALLBACK: Record<string, IfcPropertyDef[]> = {
  IFCOWNERHISTORY: [
    p('OwningUser',              'IfcPersonAndOrganization', false),
    p('OwningApplication',       'IfcApplication',           false),
    p('State',                   'IfcStateEnum',             true),
    p('ChangeAction',            'IfcChangeActionEnum',      true),
    p('LastModifiedDate',        'IfcTimeStamp',             true),
    p('LastModifyingUser',       'IfcPersonAndOrganization', true),
    p('LastModifyingApplication','IfcApplication',           true),
    p('CreationDate',            'IfcTimeStamp',             false),
  ],
  IFCPERSON: [
    p('Identification', 'IfcIdentifier',        true),
    p('FamilyName',     'IfcLabel',             true),
    p('GivenName',      'IfcLabel',             true),
    p('MiddleNames',    'LIST OF IfcLabel',     true),
    p('PrefixTitles',   'LIST OF IfcLabel',     true),
    p('SuffixTitles',   'LIST OF IfcLabel',     true),
    p('Roles',          'LIST OF IfcActorRole', true),
    p('Addresses',      'LIST OF IfcAddress',   true),
  ],
  IFCORGANIZATION: [
    p('Identification', 'IfcIdentifier',        true),
    p('Name',           'IfcLabel',             false),
    p('Description',    'IfcText',              true),
    p('Roles',          'LIST OF IfcActorRole', true),
    p('Addresses',      'LIST OF IfcAddress',   true),
  ],
  IFCPERSONANDORGANIZATION: [
    p('ThePerson',       'IfcPerson',           false),
    p('TheOrganization', 'IfcOrganization',     false),
    p('Roles',           'LIST OF IfcActorRole',true),
  ],
  IFCAPPLICATION: [
    p('ApplicationDeveloper',  'IfcOrganization', false),
    p('Version',               'IfcLabel',        false),
    p('ApplicationFullName',   'IfcLabel',        false),
    p('ApplicationIdentifier', 'IfcIdentifier',   false),
  ],
  IFCACTORROLE: [
    p('Role',           'IfcRoleEnum', false),
    p('UserDefinedRole','IfcLabel',    true),
    p('Description',    'IfcText',     true),
  ],
  // IfcAddress supertype attrs come first, then subtype-specific ones
  IFCPOSTALADDRESS: [
    p('Purpose',          'IfcAddressTypeEnum',  true),
    p('Description',      'IfcText',             true),
    p('UserDefinedPurpose','IfcLabel',            true),
    p('InternalLocation', 'IfcLabel',            true),
    p('AddressLines',     'LIST OF IfcLabel',    true),
    p('PostalBox',        'IfcLabel',            true),
    p('Town',             'IfcLabel',            true),
    p('Region',           'IfcLabel',            true),
    p('PostalCode',       'IfcLabel',            true),
    p('Country',          'IfcLabel',            true),
  ],
  IFCTELECOMADDRESS: [
    p('Purpose',                 'IfcAddressTypeEnum',   true),
    p('Description',             'IfcText',              true),
    p('UserDefinedPurpose',      'IfcLabel',             true),
    p('TelephoneNumbers',        'LIST OF IfcLabel',     true),
    p('FacsimileNumbers',        'LIST OF IfcLabel',     true),
    p('PagerNumber',             'IfcLabel',             true),
    p('ElectronicMailAddresses', 'LIST OF IfcLabel',     true),
    p('WWWHomePageURL',          'IfcURIReference',      true),
    p('MessagingIDs',            'LIST OF IfcURIReference', true),
  ],
  // Units
  IFCUNITASSIGNMENT: [
    p('Units', 'SET OF IfcUnit', false),
  ],
  IFCDIMENSIONALEXPONENTS: [
    p('LengthExponent',                   'INTEGER', false),
    p('MassExponent',                     'INTEGER', false),
    p('TimeExponent',                     'INTEGER', false),
    p('ElectricCurrentExponent',          'INTEGER', false),
    p('ThermodynamicTemperatureExponent', 'INTEGER', false),
    p('AmountOfSubstanceExponent',        'INTEGER', false),
    p('LuminousIntensityExponent',        'INTEGER', false),
  ],
  IFCMEASUREWITHUNIT: [
    p('ValueComponent', 'IfcValue', false),
    p('UnitComponent',  'IfcUnit',  false),
  ],
  IFCDERIVEDUNIT: [
    p('Elements',        'SET OF IfcDerivedUnitElement', false),
    p('UnitType',        'IfcDerivedUnitEnum',           false),
    p('UserDefinedType', 'IfcLabel',                     true),
  ],
  IFCDERIVEDUNITELEMENT: [
    p('Unit',     'IfcNamedUnit', false),
    p('Exponent', 'INTEGER',      false),
  ],
  IFCMONETARYUNIT: [
    p('Currency', 'IfcLabel', false),
  ],
  // Materials (IfcMaterialList is IFC2X3-only; removed in IFC4)
  IFCMATERIALLIST: [
    p('Materials', 'LIST OF IfcMaterial', false),
  ],
  // Table
  IFCTABLE: [
    p('Name',    'IfcLabel',              true),
    p('Rows',    'LIST OF IfcTableRow',   true),
    p('Columns', 'LIST OF IfcTableColumn', true),
  ],
  IFCTABLEROW: [
    p('RowCells',  'LIST OF IfcValue', true),
    p('IsHeading', 'IfcBoolean',       true),
  ],
  IFCTABLECOLUMN: [
    p('Identifier',    'IfcIdentifier', true),
    p('Name',          'IfcLabel',      true),
    p('Description',   'IfcText',       true),
    p('Unit',          'IfcUnit',       true),
    p('ReferencePath', 'IfcReference',  true),
  ],
};

/**
 * Return the ordered list of explicit STEP attributes for `entityName`,
 * including inherited attributes from all supertypes (root first).
 *
 * Tries IFC4 → IFC4X3 → IFC2X3 → static fallback in that order.
 * Returns [] if schemas are still loading or the entity is unknown.
 */
export function getSchemaProps(entityName: string): IfcPropertyDef[] {
  if (!entityName) return [];

  const r4 = resolveIfc4?.(entityName);
  if (r4 && r4.length > 0) return r4;

  const r4x3 = resolveIfc4x3?.(entityName);
  if (r4x3 && r4x3.length > 0) return r4x3;

  const r2x3 = resolveIfc2x3?.(entityName);
  if (r2x3 && r2x3.length > 0) return r2x3;

  // Final fallback: non-rooted entities absent from the generated JSONs
  return STATIC_FALLBACK[entityName.toUpperCase()] ?? [];
}
