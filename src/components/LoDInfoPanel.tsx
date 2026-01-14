import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoDLevel } from '@/lib/graphLoD';
import {
  getLoDDescription,
  compareLoDLevels,
  LoDDescription,
} from '@/lib/lodDescriptions';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface LoDInfoPanelProps {
  currentLod: LoDLevel;
  onLodChange?: (lod: LoDLevel) => void;
  graphStats?: {
    totalNodes: number;
    totalEdges: number;
    filteredNodes?: number;
    filteredEdges?: number;
  };
}

export function LoDInfoPanel({
  currentLod,
  onLodChange,
  graphStats,
}: LoDInfoPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [compareWith, setCompareWith] = useState<LoDLevel | null>(null);

  const currentDesc = getLoDDescription(currentLod);
  const nextLod = (currentLod + 1) as LoDLevel;
  const prevLod = (currentLod - 1) as LoDLevel;
  const hasNextLod = currentLod < 5;
  const hasPrevLod = currentLod > 1;

  const comparison =
    compareWith && compareWith !== currentLod
      ? compareLoDLevels(currentLod, compareWith)
      : null;

  const nodeReduction = parseInt(currentDesc.nodeReductionEstimate);
  const estimatedNodes = graphStats
    ? Math.round(graphStats.totalNodes * (100 - nodeReduction) / 100)
    : null;

  return (
    <div className="space-y-2">
      {/* Current LoD Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{currentDesc.name}</CardTitle>
              <CardDescription className="mt-1">
                {currentDesc.description}
              </CardDescription>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 hover:bg-white/20 rounded"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="space-y-4 pt-0">
            {/* Stats */}
            {graphStats && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-white/50 dark:bg-black/20 rounded">
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Total Nodes
                  </div>
                  <div className="text-lg font-semibold">
                    {graphStats.totalNodes.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Total Edges
                  </div>
                  <div className="text-lg font-semibold">
                    {graphStats.totalEdges.toLocaleString()}
                  </div>
                </div>
                {graphStats.filteredNodes !== undefined && (
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      After LoD Filter
                    </div>
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {graphStats.filteredNodes.toLocaleString()}
                    </div>
                  </div>
                )}
                {graphStats.filteredEdges !== undefined && (
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Filtered Edges
                    </div>
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {graphStats.filteredEdges.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Includes/Excludes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold mb-2 text-green-700 dark:text-green-300">
                  ✓ Includes
                </h4>
                <div className="space-y-1">
                  {currentDesc.includes.map((item) => (
                    <div key={item} className="text-xs text-gray-700 dark:text-gray-300">
                      • {item}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-red-700 dark:text-red-300">
                  ✗ Excludes
                </h4>
                <div className="space-y-1">
                  {currentDesc.excludes.map((item) => (
                    <div key={item} className="text-xs text-gray-700 dark:text-gray-300">
                      • {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Use Cases */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Best For</h4>
              <div className="flex flex-wrap gap-2">
                {currentDesc.bestFor.map((useCase) => (
                  <Badge key={useCase} variant="secondary" className="text-xs">
                    {useCase}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Node Reduction */}
            <div className="p-3 bg-white/50 dark:bg-black/20 rounded">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Node Reduction</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {currentDesc.nodeReductionEstimate}
                </span>
              </div>
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${nodeReduction}%`,
                  }}
                />
              </div>
              {estimatedNodes !== null && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  ~{estimatedNodes.toLocaleString()} nodes at this LoD
                </div>
              )}
            </div>

            {/* Navigation */}
            {(hasPrevLod || hasNextLod) && (
              <div className="flex gap-2 pt-2">
                {hasPrevLod && onLodChange && (
                  <button
                    onClick={() => onLodChange(prevLod)}
                    className="flex-1 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded font-medium flex items-center justify-center gap-1"
                  >
                    ← Previous LoD
                  </button>
                )}
                {hasNextLod && onLodChange && (
                  <button
                    onClick={() => onLodChange(nextLod)}
                    className="flex-1 px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded font-medium flex items-center justify-center gap-1"
                  >
                    Next LoD →
                  </button>
                )}
              </div>
            )}

            {/* Comparison */}
            <div className="border-t pt-3">
              <h4 className="text-sm font-semibold mb-2">Compare With</h4>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((lod) => {
                  if (lod === currentLod) return null;
                  return (
                    <button
                      key={lod}
                      onClick={() =>
                        setCompareWith(compareWith === lod ? null : (lod as LoDLevel))
                      }
                      className={`px-3 py-1 text-xs rounded font-medium transition ${
                        compareWith === lod
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      LoD{lod}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comparison Results */}
            {comparison && (
              <Card className="bg-white dark:bg-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {comparison.lod1.shortName} vs {comparison.lod2.shortName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {comparison.differences.map((diff) => (
                    <div key={diff} className="text-xs text-gray-700 dark:text-gray-300">
                      {diff}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </CardContent>
        )}
      </Card>

      {/* Quick Stats */}
      {!expanded && graphStats && (
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-center">
            <div className="font-semibold">{graphStats.totalNodes.toLocaleString()}</div>
            <div className="text-gray-600 dark:text-gray-400">Total Nodes</div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-center">
            <div className="font-semibold">{graphStats.totalEdges.toLocaleString()}</div>
            <div className="text-gray-600 dark:text-gray-400">Total Edges</div>
          </div>
          {graphStats.filteredNodes !== undefined && (
            <div className="p-2 bg-green-50 dark:bg-green-950 rounded text-center">
              <div className="font-semibold text-green-700 dark:text-green-400">
                {graphStats.filteredNodes.toLocaleString()}
              </div>
              <div className="text-gray-600 dark:text-gray-400">After LoD</div>
            </div>
          )}
          <div className="p-2 bg-orange-50 dark:bg-orange-950 rounded text-center">
            <div className="font-semibold text-orange-700 dark:text-orange-400">
              {nodeReduction}%
            </div>
            <div className="text-gray-600 dark:text-gray-400">Reduction</div>
          </div>
        </div>
      )}
    </div>
  );
}
