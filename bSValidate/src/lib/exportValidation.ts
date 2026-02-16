/**
 * Validation Results Export Utilities
 * Supports exporting validation results to JSON, CSV, and text formats
 */

import { ValidationResult, ValidationError } from '../../../src/lib/ifcValidatorEnhanced';
import { formatStepId, extractRuleCode, extractRuleName } from './buildingsmartUtils';

/**
 * Export validation results to JSON format
 */
export function exportToJSON(result: ValidationResult, fileName: string): void {
  const json = JSON.stringify(result, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `${fileName}.json`);
}

/**
 * Export validation results to CSV format
 */
export function exportToCSV(result: ValidationResult, fileName: string): void {
  const rows: string[][] = [];

  // Add header
  rows.push([
    'Severity',
    'Type',
    'Code',
    'Message',
    'Entity ID',
    'Entity Type',
    'Property Name',
    'Functional Part',
    'Rule Code',
    'Expected',
    'Observed',
    'Suggestion',
  ]);

  // Process all errors
  const allErrors = [
    ...result.errors,
    ...result.warnings,
    ...result.info,
  ];

  allErrors.forEach(error => {
    const anyError = error as any;
    const ruleCode = extractRuleCode(anyError.feature || '');
    const stepId = formatStepId(anyError.instance_public_id || error.entityId);

    const expected = anyError.expectedValue
      ? JSON.stringify(anyError.expectedValue)
      : '';
    const observed = anyError.observedValue
      ? JSON.stringify(anyError.observedValue)
      : '';

    rows.push([
      error.severity || '',
      error.type || '',
      error.code || '',
      error.message || '',
      stepId || error.entityId || '',
      error.entityType || '',
      error.propertyName || '',
      error.functionalPart || '',
      ruleCode || '',
      expected,
      observed,
      error.suggestion || '',
    ]);
  });

  const csv = rows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${fileName}.csv`);
}

/**
 * Export validation results to human-readable text format
 */
export function exportToText(result: ValidationResult, fileName: string): void {
  const lines: string[] = [];

  // Header
  lines.push('='.repeat(80));
  lines.push('IFC VALIDATION REPORT');
  lines.push('='.repeat(80));
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('-'.repeat(80));
  lines.push(`Schema Version: ${result.schemaVersion || 'Unknown'}`);
  lines.push(`Overall Status: ${result.valid ? 'VALID' : 'INVALID'}`);
  lines.push(`Total Errors: ${result.stats.totalErrors}`);
  lines.push(`Total Warnings: ${result.stats.totalWarnings}`);
  lines.push(`Total Info: ${result.stats.totalInfo}`);
  lines.push('');

  // Errors
  if (result.errors.length > 0) {
    lines.push('');
    lines.push('ERRORS');
    lines.push('='.repeat(80));
    result.errors.forEach((error, idx) => {
      lines.push('');
      lines.push(`Error #${idx + 1}`);
      lines.push('-'.repeat(40));
      addErrorToLines(error, lines);
    });
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('WARNINGS');
    lines.push('='.repeat(80));
    result.warnings.forEach((warning, idx) => {
      lines.push('');
      lines.push(`Warning #${idx + 1}`);
      lines.push('-'.repeat(40));
      addErrorToLines(warning, lines);
    });
  }

  // Info
  if (result.info.length > 0) {
    lines.push('');
    lines.push('INFORMATION');
    lines.push('='.repeat(80));
    result.info.forEach((info, idx) => {
      lines.push('');
      lines.push(`Info #${idx + 1}`);
      lines.push('-'.repeat(40));
      addErrorToLines(info, lines);
    });
  }

  // Footer
  lines.push('');
  lines.push('='.repeat(80));
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(80));

  const text = lines.join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
  downloadBlob(blob, `${fileName}.txt`);
}

/**
 * Add error details to text lines
 */
function addErrorToLines(error: ValidationError, lines: string[]): void {
  const anyError = error as any;

  lines.push(`Type: ${error.type}`);
  lines.push(`Code: ${error.code}`);
  lines.push(`Message: ${error.message}`);

  if (error.entityId || anyError.instance_public_id) {
    const stepId = formatStepId(anyError.instance_public_id || error.entityId);
    lines.push(`Entity ID: ${stepId}`);
  }

  if (error.entityType) {
    lines.push(`Entity Type: ${error.entityType}`);
  }

  if (error.propertyName) {
    lines.push(`Property: ${error.propertyName}`);
  }

  if (error.functionalPart) {
    lines.push(`Functional Part: ${error.functionalPart}${error.functionalPartName ? ` (${error.functionalPartName})` : ''}`);
  }

  if (anyError.feature) {
    const ruleCode = extractRuleCode(anyError.feature);
    const ruleName = extractRuleName(anyError.feature);
    if (ruleCode) {
      lines.push(`Rule: ${ruleCode} - ${ruleName}`);
    }
  }

  if (anyError.expectedValue) {
    lines.push(`Expected: ${JSON.stringify(anyError.expectedValue)}`);
  }

  if (anyError.observedValue) {
    lines.push(`Observed: ${JSON.stringify(anyError.observedValue)}`);
  }

  if (error.suggestion) {
    lines.push(`Suggestion: ${error.suggestion}`);
  }
}

/**
 * Download blob as file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get default filename with timestamp
 */
export function getDefaultExportFilename(prefix: string = 'validation'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}-${timestamp}`;
}
