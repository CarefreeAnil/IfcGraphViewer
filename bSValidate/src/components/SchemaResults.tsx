/**
 * Schema Validation Results Display
 * Different format from normative rules - shows entity rules with educational interpretations
 */

import { ExternalLink, AlertCircle, AlertTriangle, Info, ChevronDown, Code2, Link } from 'lucide-react';
import { ValidationError } from '../../../src/lib/ifcValidatorEnhanced';
import { GraphNode } from '../../../src/types/graph';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../src/components/ui/collapsible';
import { Badge } from '../../../src/components/ui/badge';
import { Button } from '../../../src/components/ui/button';
import { Card } from '../../../src/components/ui/card';
import { Checkbox } from '../../../src/components/ui/checkbox';
import { ScrollArea } from '../../../src/components/ui/scroll-area';
import {
  formatStepId,
  getSeverityDisplay,
  isSchemaRule,
  extractStepIdsFromMessage,
} from '../lib/buildingsmartUtils';
import {
  interpretSchemaError,
  getShortSummary,
  getRuleTypeEmoji,
  InterpretedSchemaError,
} from '../lib/schemaInterpreter';
import { useState } from 'react';

interface SchemaGroup {
  ruleName: string;
  ruleLogic?: string;
  occurrenceCount: number;
  errors: ValidationError[];
}

interface SchemaResultsProps {
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  nodes?: GraphNode[];
  onEntityClick?: (entityId: string) => void;
}

/**
 * Detect if error is from schema validation (vs normative rules)
 * Schema errors typically have detailed violation messages without rule codes
 */
function isSchemaError(error: ValidationError): boolean {
  return isSchemaRule(error);
}

/**
 * Group errors by entity rule - properly groups same rules together
 */
function groupByEntityRule(errors: ValidationError[]): SchemaGroup[] {
  const groups: Record<string, SchemaGroup> = {};

  errors.forEach(error => {
    const anyError = error as any;
    const feature = anyError.feature || error.message;

    // Extract rule name and logic
    let ruleName = feature;
    let ruleLogic: string | undefined;

    // Try to parse JSON format first
    try {
      const parsed = JSON.parse(feature);
      if (parsed.attribute) {
        ruleName = parsed.attribute;
      }
    } catch {
      // Not JSON, try to extract from feature
      if (feature.includes(' - ')) {
        const parts = feature.split(' - ');
        if (parts.length > 1) {
          ruleName = parts[1];

          // Extract logic from parentheses
          const logicMatch = ruleName.match(/\(([^)]+)\)$/);
          if (logicMatch) {
            ruleLogic = logicMatch[1];
            ruleName = ruleName.replace(/\s*\([^)]+\)$/, '');
          }
        }
      }
    }

    // Use the rule name as the key (this ensures grouping)
    const key = ruleName;

    if (!groups[key]) {
      groups[key] = {
        ruleName: key,
        ruleLogic,
        occurrenceCount: 0,
        errors: [],
      };
    }

    groups[key].errors.push(error);
    groups[key].occurrenceCount++;
  });

  // Sort by rule name alphabetically
  return Object.values(groups).sort((a, b) =>
    a.ruleName.localeCompare(b.ruleName)
  );
}

/**
 * Component to display interpreted schema error - diagnostic only
 */
function InterpretedErrorCell({
  error,
  ruleLogic,
  onEntityClick,
}: {
  error: ValidationError;
  ruleLogic?: string;
  onEntityClick?: (stepId: string) => void;
}) {
  const [showTechnical, setShowTechnical] = useState(false);
  const interpreted = interpretSchemaError(error, ruleLogic);
  const hasDiagnosis = interpreted.diagnosis;

  if (!hasDiagnosis) {
    // Fallback to simple message display
    return (
      <div className="text-xs text-muted-foreground">
        {error.message}
      </div>
    );
  }

  const ruleEmoji = getRuleTypeEmoji(interpreted.ruleAttribute);

  return (
    <div className="space-y-3">
      {/* Quick Summary */}
      {interpreted.violationSummary && (
        <div className="flex items-start gap-2">
          <span className="text-lg">{ruleEmoji}</span>
          <div className="flex-1">
            <div className="font-medium text-sm text-foreground">
              {getShortSummary(interpreted)}
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-1">
              {interpreted.violationSummary}
            </div>
          </div>
        </div>
      )}

      {/* Diagnosis - factual, not prescriptive */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
            {interpreted.diagnosis}
          </div>
        </div>
      </div>

      {/* Related Entities */}
      {interpreted.relatedElements.length > 0 && onEntityClick && (
        <div className="border-t pt-2">
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Link className="w-3 h-3" />
            Related Elements ({interpreted.relatedElements.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {interpreted.relatedElements.map((rel, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  onEntityClick(rel.id);
                }}
                className="text-xs px-2 py-1 bg-muted hover:bg-accent rounded border font-mono flex items-center gap-1 transition-colors"
                title={`${rel.relationship}: ${rel.type}`}
              >
                {rel.id}
                <ExternalLink className="w-3 h-3" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Technical Context (Collapsible) - Keep raw API response */}
      {interpreted.technicalContext && (
        <div className="border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTechnical(!showTechnical)}
            className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground -ml-1"
          >
            <Code2 className="w-3 h-3 mr-1" />
            {showTechnical ? 'Hide' : 'Show'} Technical Details
            <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showTechnical ? 'rotate-180' : ''}`} />
          </Button>
          {showTechnical && (
            <div className="mt-2 bg-muted rounded-md p-3">
              <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                {interpreted.technicalContext}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SchemaResults({
  errors,
  warnings,
  info,
  nodes,
  onEntityClick,
}: SchemaResultsProps) {
  const [includeNonErrors, setIncludeNonErrors] = useState(false);

  // Combine all results
  const allResults = includeNonErrors
    ? [...errors, ...warnings, ...info]
    : errors;

  // Filter only schema results
  const schemaResults = allResults.filter(isSchemaError);

  // Group by entity rule
  const ruleGroups = groupByEntityRule(schemaResults);

  // Get entity type from nodes if available
  const getEntityType = (entityId?: string): string => {
    if (!entityId || !nodes) return '';
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

  if (schemaResults.length === 0) {
    return (
      <div className="p-8 border rounded-lg bg-green-50 text-center">
        <Info className="w-10 h-10 text-green-500 mx-auto mb-2" />
        <p className="text-green-800 font-medium">
          No schema validation errors found!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter checkbox */}
      <div className="flex items-center space-x-2 pb-2 border-b">
        <Checkbox
          id="include-passed-schema"
          checked={includeNonErrors}
          onCheckedChange={(checked: boolean) => setIncludeNonErrors(checked === true)}
        />
        <label
          htmlFor="include-passed-schema"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
           Include Passed, Disabled and N/A
        </label>
      </div>

      {/* Rule groups */}
      <div className="space-y-3">
        {ruleGroups.map((group, idx) => (
          <Card key={idx} className="overflow-hidden">
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 text-left">
                    {getSeverityIcon(group.errors[0].severity)}
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        <span>{getRuleTypeEmoji(group.ruleName)}</span>
                        <span>Entity Rule - {group.ruleName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        occurred {group.occurrenceCount}{' '}
                        {group.occurrenceCount === 1 ? 'time' : 'times'}
                      </div>
                      {group.ruleLogic && (
                        <div className="text-xs text-muted-foreground mt-1 font-mono bg-muted/30 px-2 py-1 rounded inline-block">
                          {group.ruleLogic}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform ui-state-open:rotate-180" />
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t p-4 space-y-4">
                  {/* Render errors as cards for better readability */}
                  {group.errors.map((error, errorIdx) => {
                    // Interpret error to get correct entity ID and type
                    const interpreted = interpretSchemaError(error, group.ruleLogic);
                    const stepId = interpreted.entityId || formatStepId((error as any).instance_public_id || error.entityId);
                    const entityType = interpreted.entityType || getEntityType((error as any).instance_public_id || error.entityId);

                    return (
                      <Card key={errorIdx} className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-2">
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
                            {stepId && (
                              <div className="font-mono text-xs text-muted-foreground">
                                {stepId}
                              </div>
                            )}
                            {entityType && (
                              <Badge variant="outline" className="text-xs">
                                {entityType}
                              </Badge>
                            )}
                          </div>
                          {onEntityClick && stepId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => onEntityClick(stepId)}
                              title="Navigate to entity in graph"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          )}
                        </div>

                        <InterpretedErrorCell
                          error={error}
                          ruleLogic={group.ruleLogic}
                          onEntityClick={onEntityClick}
                        />
                      </Card>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>
    </div>
  );
}
