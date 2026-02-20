/**
 * BuildingSMART-style Validation Results Display
 * Matches the buildingSMART validation platform UI with rule grouping, StepID format, and expected/observed columns
 */

import { ExternalLink, AlertCircle, AlertTriangle, Info, ChevronDown } from 'lucide-react';
import { ValidationError } from '../../../src/lib/ifcValidatorEnhanced';
import { GraphNode } from '../../../src/types/graph';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../src/components/ui/collapsible';
import { Badge } from '../../../src/components/ui/badge';
import { Button } from '../../../src/components/ui/button';
import { Card } from '../../../src/components/ui/card';
import { Checkbox } from '../../../src/components/ui/checkbox';
import { ScrollArea } from '../../../src/components/ui/scroll-area';
import {
  groupByRuleCode,
  formatStepId,
  formatValue,
  getSeverityDisplay,
  isBuildingSmartError,
  isSchemaRule,
} from '../lib/buildingsmartUtils';
import { extractNormativeEntityInfo } from '../lib/normativeInterpreter';
import { useState } from 'react';

interface BuildingSmartResultsProps {
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  nodes?: GraphNode[];
  onEntityClick?: (entityId: string) => void;
}

export function BuildingSmartResults({
  errors,
  warnings,
  info,
  nodes,
  onEntityClick,
}: BuildingSmartResultsProps) {
  const [includeInfoResults, setIncludeInfoResults] = useState(false);

  // Combine all results
  const allResults = [...errors, ...warnings, ...info];

  // Filter based on checkbox:
  // - Unchecked: Show only errors and warnings (exclude info-level results)
  // - Checked: Show everything including info-level results
  const filteredResults = includeInfoResults
    ? allResults
    : [...errors, ...warnings];

  // Filter only buildingSMART normative rules (exclude schema/entity rules)
  const buildingsmartResults = filteredResults.filter(error =>
    isBuildingSmartError(error) && !isSchemaRule(error)
  );

  // Group by rule code
  const ruleGroups = groupByRuleCode(buildingsmartResults) ;

  // Get entity type from nodes if available
  const getEntityType = (entityId?: string): string => {
    if (!entityId || !nodes) return '';

    // Try to find entity in graph nodes
    const stepIdNum = entityId.replace(/[#i]/g, '');
    const node = nodes.find(
      (n) =>
        n.id === entityId ||
        `#${n.expressId}` === entityId ||
        String(n.expressId) === stepIdNum
    );

    return node?.ifcType || '';
  };

  // Get severity icon
  const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  if (buildingsmartResults.length === 0) {
    return (
      <div className="p-8 border rounded-lg bg-muted/30 text-center">
        <Info className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">
          No buildingSMART validation results available.
          <br />
          <span className="text-xs">
            BuildingSMART results will appear here when using the buildingSMART
            validator.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter checkbox and count */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="include-info"
            checked={includeInfoResults}
            onCheckedChange={(checked: boolean) => setIncludeInfoResults(checked === true)}
          />
          <label
            htmlFor="include-info"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Include Info-level Results
          </label>
        </div>
        <div className="text-sm text-muted-foreground">
          {buildingsmartResults.length} result{buildingsmartResults.length !== 1 ? 's' : ''}
          {!includeInfoResults && info.length > 0 && (
            <span className="ml-1">
              ({info.length} info hidden)
            </span>
          )}
        </div>
      </div>

      {/* Rule groups */}
      <div className="space-y-3">
        {ruleGroups.map((group) => (
          <Card key={group.ruleCode} className="overflow-hidden">
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 text-left">
                    {getSeverityIcon(group.errors[0].severity)}
                    <div className="flex-1">
                      <div className="font-medium">
                        {group.ruleCode} - {group.ruleName}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        occurred {group.occurrenceCount}{' '}
                        {group.occurrenceCount === 1 ? 'time' : 'times'}
                      </div>
                    </div>
                    {group.functionalPart && (
                      <Badge
                        variant="outline"
                        className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-800 border-blue-300"
                        title={group.functionalPartName}
                      >
                        {group.functionalPart}
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform ui-state-open:rotate-180" />
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t">
                  {/* Rule description and documentation link */}
                  {group.documentationLink && (
                    <div className="px-4 py-3 bg-muted/30 text-sm flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-muted-foreground mb-2">
                          {group.ruleDescription}
                        </p>
                        <a
                          href={group.documentationLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-xs inline-flex items-center gap-1"
                        >
                          View rule documentation
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Results table */}
                  <ScrollArea className="max-h-96">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium">Severity</th>
                          <th className="text-left p-2 font-medium">Id</th>
                          <th className="text-left p-2 font-medium">Entity</th>
                          <th className="text-left p-2 font-medium">Expected</th>
                          <th className="text-left p-2 font-medium">Observed</th>
                          {onEntityClick && <th className="w-16"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {group.errors.map((error, idx) => {
                          const anyError = error as any;

                          // Extract entity info from normative results
                          const entityInfo = extractNormativeEntityInfo(error);

                          // Use extracted info or fallback to instance_public_id
                          const primaryStepId = entityInfo.stepIds.length > 0
                            ? entityInfo.stepIds[0]
                            : formatStepId(anyError.instance_public_id || error.entityId);

                          const primaryEntityType = entityInfo.entityTypes.length > 0
                            ? entityInfo.entityTypes[0]
                            : getEntityType(anyError.instance_public_id || error.entityId);

                          const expected = formatValue(anyError.expectedValue);
                          const observed = formatValue(anyError.observedValue);

                          return (
                            <tr
                              key={idx}
                              className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                            >
                              <td className="p-2">
                                <span
                                  className={`text-xs px-2 py-1 rounded font-medium ${
                                    error.severity === 'error'
                                      ? 'bg-red-100 text-red-800'
                                      : error.severity === 'warning'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {getSeverityDisplay(error.severity)}
                                </span>
                              </td>
                              <td className="p-2 font-mono text-xs">
                                {primaryStepId || '-'}
                                {/* Show additional StepIDs if multiple found */}
                                {entityInfo.stepIds.length > 1 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {entityInfo.stepIds.slice(1, 4).map((id, i) => (
                                      <button
                                        key={i}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onEntityClick?.(id);
                                        }}
                                        className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-mono"
                                        title={`View ${id}`}
                                      >
                                        {id}
                                      </button>
                                    ))}
                                    {entityInfo.stepIds.length > 4 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        +{entityInfo.stepIds.length - 4} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="p-2 text-xs">
                                {primaryEntityType || error.entityType || '-'}
                                {/* Show additional entity types if multiple found */}
                                {entityInfo.entityTypes.length > 1 && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    +{entityInfo.entityTypes.length - 1} more
                                  </div>
                                )}
                              </td>
                              <td className="p-2 text-xs max-w-xs truncate" title={expected}>
                                {expected}
                              </td>
                              <td className="p-2 text-xs max-w-xs truncate" title={observed}>
                                {observed}
                              </td>
                              {onEntityClick && primaryStepId && (
                                <td className="p-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => onEntityClick(primaryStepId)}
                                    title="Navigate to entity"
                                  >
                                    View
                                  </Button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {ruleGroups.length === 0 && includeInfoResults && (
        <div className="p-8 border rounded-lg bg-green-50 text-center">
          <Info className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-green-800 font-medium">
            All validations passed!
          </p>
        </div>
      )}
    </div>
  );
}
