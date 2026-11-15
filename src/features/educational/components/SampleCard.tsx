/**
 * Sample Card Component
 * Displays educational IFC sample with metadata and loading action
 */

import { useState } from 'react';
import { Clock, FileCode, Target, ChevronDown, GraduationCap, ExternalLink } from 'lucide-react';
import { EducationalSample } from '@/features/educational/data/educationalSamples';
import { glossaryHighlight } from '@/features/educational/components/GlossaryTerm';
import { Badge } from '@/components/ui/badge';

interface SampleCardProps {
  sample: EducationalSample;
  onLoadSample: (sample: EducationalSample) => void;
  isLoading?: boolean;
}

export function SampleCard({ sample, onLoadSample, isLoading = false }: SampleCardProps) {
  const [expandedConcepts, setExpandedConcepts] = useState(false);
  const [expandedDescription, setExpandedDescription] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatLoadTime = (ms: number) => {
    if (ms < 1000) return `~${ms}ms`;
    return `~${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="group relative bg-card rounded-lg border border-border hover:border-primary/50 transition-all duration-300 overflow-hidden">
      {/* Thumbnail or Placeholder */}
      <div className="h-36 bg-muted relative overflow-hidden">
        {sample.thumbnail ? (
          <img
            src={sample.thumbnail}
            alt={sample.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/[0.06]">
            <FileCode className="w-16 h-16 text-primary/40" />
          </div>
        )}

        {/* Guided Learning Badge */}
        {sample.hasGuidedLearning && (
          <Badge
            className="absolute top-2 right-2 bg-emerald-500 hover:bg-emerald-600 text-white gap-1 shadow-lg"
          >
            <GraduationCap className="w-3 h-3" />
            Guided Learning
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title and Description */}
        <div>
          <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
            {sample.sourceUrl ? (
              <a href={sample.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                {sample.name}
                <ExternalLink className="h-3.5 w-3.5" aria-label="Open Solibri website" />
              </a>
            ) : (
              sample.name
            )}
          </h3>
          <div className="space-y-1.5 mt-1">
            <p className={`text-sm text-muted-foreground ${expandedDescription ? '' : 'line-clamp-2'}`}>
              {glossaryHighlight(sample.description)}
            </p>
            {sample.description.length > 80 && (
              <button
                onClick={() => setExpandedDescription(!expandedDescription)}
                className="text-xs text-primary font-medium hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${expandedDescription ? 'rotate-180' : ''}`} />
                {expandedDescription ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <FileCode className="w-3.5 h-3.5" />
            <span>{formatFileSize(sample.fileSize)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Target className="w-3.5 h-3.5" />
            <span>{sample.entityCount} entities</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatLoadTime(sample.estimatedLoadTime)}</span>
          </div>
        </div>

        {/* Concepts */}
        {sample.concepts.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {sample.concepts.slice(0, 2).map((concept) => (
                <span
                  key={concept}
                  className="px-2 py-0.5 bg-primary/5 text-primary text-xs rounded border border-primary/10"
                >
                  {concept}
                </span>
              ))}
              {sample.concepts.length > 2 && !expandedConcepts && (
                <button
                  onClick={() => setExpandedConcepts(true)}
                  className="px-2 py-0.5 bg-muted text-primary text-xs rounded border border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer font-medium"
                >
                  +{sample.concepts.length - 2}
                </button>
              )}
            </div>
            {expandedConcepts && sample.concepts.length > 2 && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
                {sample.concepts.slice(2).map((concept) => (
                  <span
                    key={concept}
                    className="px-2 py-0.5 bg-primary/5 text-primary text-xs rounded border border-primary/10"
                  >
                    {concept}
                  </span>
                ))}
                <button
                  onClick={() => setExpandedConcepts(false)}
                  className="px-2 py-0.5 text-primary text-xs font-medium hover:text-primary/80 transition-colors"
                >
                  Show less
                </button>
              </div>
            )}
          </div>
        )}

        {/* Load Button */}
        <button
          onClick={() => onLoadSample(sample)}
          disabled={isLoading}
          className="w-full mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Loading...' : 'Load Sample'}
        </button>
      </div>
    </div>
  );
}
