/**
 * IFC5 Source Viewer
 * Displays the .ifcx file content exactly as it appears in a text editor —
 * continuous syntax-highlighted JSON. Each node in the `data` array is a
 * clickable block that cross-syncs selection with the Graph, Tree, and 3D panels.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileCode2, Copy, X, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { IFC5File, IFC5Node, ComposedObject } from '@/types/ifc5';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// ─── Syntax highlighting ──────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Truncate large arrays so geometry blobs don't freeze the browser */
function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length > 32) return `[… ${value.length} items]`;
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeValue(v)])
    );
  }
  return value;
}

/**
 * Recursively search `value` for a string that contains `term`.
 * Returns true as soon as a match is found.
 * Skips large numeric arrays to stay fast.
 */
function deepSearch(value: unknown, term: string): boolean {
  if (typeof value === 'string') return value.toLowerCase().includes(term);
  if (typeof value === 'number') return String(value).includes(term);
  if (typeof value === 'boolean') return String(value).includes(term);
  if (Array.isArray(value)) {
    // Skip geometry arrays (large arrays of numbers) for performance
    if (value.length > 32 && typeof value[0] === 'number') return false;
    return value.some(item => deepSearch(item, term));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([k, v]) => k.toLowerCase().includes(term) || deepSearch(v, term)
    );
  }
  return false;
}

function highlight(value: unknown): string {
  const json = escapeHtml(JSON.stringify(sanitizeValue(value), null, 2));
  return json
    // Object keys
    .replace(/&quot;([\w:.\-/@ ]+)&quot;(\s*:)/g,
      '<span class="text-sky-400">&quot;$1&quot;</span>$2')
    // Truncation placeholders
    .replace(/:\s*(&quot;\[…[^&]*\]&quot;)/g,
      ': <span class="text-gray-500 italic">$1</span>')
    // String values
    .replace(/:\s*(&quot;[^&]*&quot;)/g,
      ': <span class="text-green-400">$1</span>')
    // Numbers
    .replace(/:\s*(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g,
      ': <span class="text-purple-400">$1</span>')
    // Booleans
    .replace(/:\s*(true|false)\b/g,
      ': <span class="text-pink-400">$1</span>')
    // Null
    .replace(/:\s*(null)\b/g,
      ': <span class="text-gray-500">$1</span>');
}

/** Render a single IFC5Node as indented JSON text (4-space indent, as part of the data array) */
function renderNodeJson(node: IFC5Node): string {
  const obj: Record<string, unknown> = { path: node.path };
  if (node.inherits && Object.keys(node.inherits).length > 0) obj.inherits = node.inherits;
  if (node.children && Object.keys(node.children).length > 0) obj.children = node.children;
  if (node.attributes && Object.keys(node.attributes).length > 0) obj.attributes = node.attributes;
  // Indent each line by 4 spaces to match being inside the "data" array
  return highlight(obj)
    .split('\n')
    .map(line => '    ' + line)
    .join('\n');
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface IFC5SourceViewerProps {
  ifc5File: IFC5File;
  composedObject: ComposedObject | null;
  selectedPath: string | null;
  onNodeSelect: (path: string, node: ComposedObject) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const IFC5SourceViewer: React.FC<IFC5SourceViewerProps> = ({
  ifc5File,
  composedObject,
  selectedPath,
  onNodeSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const nodes = ifc5File.data;

  // ── path → ComposedObject lookup map ─────────────────────────────────────
  const nodePathMap = useMemo(() => {
    const map = new Map<string, ComposedObject>();
    if (!composedObject) return map;
    const traverse = (obj: ComposedObject) => {
      map.set(obj.name, obj);
      obj.children?.forEach(traverse);
    };
    traverse(composedObject);
    return map;
  }, [composedObject]);

  // ── Is selected raw node in the composed scene tree? ─────────────────────
  // Raw nodes that define prototypes / class templates exist in ifc5File.data
  // but are NOT part of the composed scene hierarchy. When one is selected,
  // the Tree Browser and Graph cannot show a selection because they work on
  // the composed tree, not the raw pre-composition data.
  const selectedIsInTree = useMemo(() => {
    if (!selectedPath) return null; // nothing selected
    return nodePathMap.has(selectedPath);
  }, [selectedPath, nodePathMap]);

  // ── File header section (everything except data[]) ────────────────────────
  const headerHtml = useMemo(() => {
    const headerObj: Record<string, unknown> = {};
    if (ifc5File.header) headerObj.header = ifc5File.header;
    if (ifc5File.imports?.length) headerObj.imports = ifc5File.imports;
    if (ifc5File.schemas && Object.keys(ifc5File.schemas).length)
      headerObj.schemas = ifc5File.schemas;
    if (Object.keys(headerObj).length === 0) return null;
    return highlight(headerObj)
      // Remove the outer closing brace since we continue with "data"
      .replace(/\n\}$/, '');
  }, [ifc5File]);

  // ── Search: find matching node paths ─────────────────────────────────────
  const matchingPaths = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return nodes
      .filter(n =>
        n.path.toLowerCase().includes(term) ||
        Object.keys(n.attributes ?? {}).some(k => k.toLowerCase().includes(term)) ||
        // deepSearch covers nested objects, arrays of strings, boolean values, etc.
        Object.entries(n.attributes ?? {}).some(([k, v]) => {
          // Skip heavy geometry arrays for search perf
          if (k.includes('mesh::') || k.includes('basiscurves::')) return false;
          return deepSearch(v, term);
        })
      )
      .map(n => n.path);
  }, [nodes, searchTerm]);

  // ── Scroll to selected node (cross-panel selection) ───────────────────────
  useEffect(() => {
    if (!selectedPath) return;
    const el = nodeRefs.current.get(selectedPath);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, [selectedPath]);

  // ── Scroll to search match ────────────────────────────────────────────────
  useEffect(() => {
    if (matchingPaths.length === 0) return;
    const path = matchingPaths[matchIndex % matchingPaths.length];
    const el = nodeRefs.current.get(path);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [matchingPaths, matchIndex]);

  // Reset match index when search term changes
  useEffect(() => { setMatchIndex(0); }, [searchTerm]);

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((node: IFC5Node) => {
    const composed = nodePathMap.get(node.path) ?? { name: node.path, attributes: node.attributes };
    onNodeSelect(node.path, composed);
  }, [nodePathMap, onNodeSelect]);

  // ── Copy selected node ────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const node = nodes.find(n => n.path === selectedPath);
    if (!node) return;
    const raw: Record<string, unknown> = { path: node.path };
    if (node.inherits) raw.inherits = node.inherits;
    if (node.children) raw.children = node.children;
    if (node.attributes) raw.attributes = node.attributes;
    navigator.clipboard.writeText(JSON.stringify(raw, null, 2));
    toast.success('Copied node JSON');
  }, [nodes, selectedPath]);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground bg-card">
        <FileCode2 className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">No IFC5 source data</p>
        <p className="text-xs mt-1 opacity-60">Load an .ifcx file to view source</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#d4d4d4]">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-card/80 shrink-0">
        <FileCode2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground flex-1 truncate">
          IFC5 Source
          <span className="ml-1 opacity-50">· {nodes.length} nodes</span>
          <span className="ml-1 opacity-40 italic">· raw .ifcx (before composition)</span>
        </span>
        {selectedPath && (
          <button
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
            title="Copy selected node JSON"
          >
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* ── "Prototype" notice — shown when the selected raw node is not in the
           composed scene tree (e.g. class definitions, shared geometry prims).
           Explains why Tree Browser and Graph don't highlight it. ─────────── */}
      {selectedIsInTree === false && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/40 bg-yellow-500/5 shrink-0">
          <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />
          <span className="text-[11px] text-yellow-600 dark:text-yellow-400">
            Prototype / definition node — not present in the composed scene tree.
            Tree Browser and Graph only show composed scene nodes.
          </span>
        </div>
      )}

      {/* ── Search bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/40 bg-card/60 shrink-0">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Find node… (path, attribute key/value, GUID)"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (e.shiftKey) {
                  // Navigate backwards
                  setMatchIndex(i => (i - 1 + Math.max(matchingPaths.length, 1)) % Math.max(matchingPaths.length, 1));
                } else {
                  setMatchIndex(i => i + 1);
                }
              }
              if (e.key === 'Escape') setSearchTerm('');
            }}
            className="h-6 text-[11px] pr-6 bg-background/50 border-border/40 font-mono"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Match counter */}
        {matchingPaths.length > 0 && (
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {(matchIndex % matchingPaths.length) + 1}/{matchingPaths.length}
          </span>
        )}
        {searchTerm && matchingPaths.length === 0 && (
          <span className="text-[10px] text-red-400 whitespace-nowrap">No match</span>
        )}

        {/* Prev / Next buttons */}
        {matchingPaths.length > 1 && (
          <>
            <button
              onClick={() => setMatchIndex(i => (i - 1 + matchingPaths.length) % matchingPaths.length)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded"
              title="Previous match (Shift+Enter)"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => setMatchIndex(i => (i + 1) % matchingPaths.length)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded"
              title="Next match (Enter)"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </>
        )}
      </div>

      {/* ── JSON content (scrollable) ─────────────────────────────────────── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto min-h-0">
        <div className="p-4 font-mono text-[12px] leading-relaxed min-w-max">

          {/* File opening brace + header/imports/schemas */}
          {headerHtml ? (
            <pre
              className="whitespace-pre text-[#d4d4d4] inline"
              dangerouslySetInnerHTML={{ __html: headerHtml }}
            />
          ) : (
            <span className="text-[#d4d4d4]">{'{'}</span>
          )}

          {/* data array opening */}
          <pre className="whitespace-pre text-[#d4d4d4]">
            {headerHtml ? ',\n  ' : '\n  '}
            <span className="text-sky-400">&quot;data&quot;</span>: {`[\n`}
          </pre>

          {/* Each IFC5Node as a clickable block */}
          {nodes.map((node, i) => {
            const isSelected = node.path === selectedPath;
            const isMatch = searchTerm
              ? matchingPaths.includes(node.path)
              : false;
            const isCurrentMatch = searchTerm
              ? matchingPaths[matchIndex % matchingPaths.length] === node.path
              : false;

            return (
              <div
                key={node.path}
                ref={el => {
                  if (el) nodeRefs.current.set(node.path, el);
                  else nodeRefs.current.delete(node.path);
                }}
                onClick={() => handleNodeClick(node)}
                className={[
                  'cursor-pointer transition-colors duration-100 relative',
                  isSelected
                    ? 'bg-blue-500/10 border-l-2 border-blue-500'
                    : isCurrentMatch
                    ? 'bg-yellow-500/10 border-l-2 border-yellow-400'
                    : isMatch
                    ? 'bg-yellow-500/5 border-l-2 border-yellow-600/40'
                    : 'border-l-2 border-transparent hover:bg-white/5',
                  // Dim non-matching nodes during search
                  searchTerm && !isMatch && !isSelected ? 'opacity-30' : '',
                ].join(' ')}
                title={`Click to select: ${node.path}`}
              >
                <pre
                  className="whitespace-pre text-[#d4d4d4] pl-1"
                  dangerouslySetInnerHTML={{
                    __html: renderNodeJson(node) + (i < nodes.length - 1 ? ',' : ''),
                  }}
                />
              </div>
            );
          })}

          {/* data array closing + file closing brace */}
          <pre className="whitespace-pre text-[#d4d4d4]">{'  ]\n}'}</pre>
        </div>
      </div>

    </div>
  );
};
