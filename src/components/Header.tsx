import { motion } from 'framer-motion';
import { Network, Upload, RotateCcw, BarChart3 } from 'lucide-react';

interface HeaderProps {
  hasData: boolean;
  onReset: () => void;
  onLoadSample: () => void;
  onShowAnalytics?: () => void;
}

export function Header({ hasData, onReset, onLoadSample, onShowAnalytics }: HeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-background/80 backdrop-blur-md border-b border-border"
    >
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20 glow-primary">
            <Network className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gradient">IFC Graph Visualizer</h1>
            <p className="text-xs text-muted-foreground">Parse • Transform • Explore</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasData && (
            <>
              <button
                onClick={onShowAnalytics}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium text-foreground transition-colors"
                title="Show analytics and metrics"
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </button>
            </>
          )}
          {!hasData && (
            <button
              onClick={onLoadSample}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium text-foreground transition-colors"
            >
              <Upload className="w-4 h-4" />
              Load Sample
            </button>
          )}
          {hasData && (
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium text-foreground transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>
      </div>
    </motion.header>
  );
}
