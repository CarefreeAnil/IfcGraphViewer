import { motion, AnimatePresence } from 'framer-motion';
import { X, Box, Hash, Tag, FileCode } from 'lucide-react';
import { GraphNode, NodeType } from '@/types/graph';

interface NodeDetailsPanelProps {
  node: GraphNode | null;
  onClose: () => void;
}

const TYPE_ICONS: Record<NodeType, React.ReactNode> = {
  building: <Box className="w-5 h-5" />,
  space: <Box className="w-5 h-5" />,
  element: <Box className="w-5 h-5" />,
  property: <Tag className="w-5 h-5" />,
  relationship: <Box className="w-5 h-5" />,
};

const TYPE_LABELS: Record<NodeType, string> = {
  building: 'Building Structure',
  space: 'Space',
  element: 'Building Element',
  property: 'Property Set',
  relationship: 'Relationship',
};

interface NodeDetailsPanelProps {
  node: GraphNode | null;
  onClose: () => void;
  inline?: boolean;
}

export function NodeDetailsPanel({ node, onClose, inline = false }: NodeDetailsPanelProps) {
  if (inline) {
    // Inline mode for property viewer sidebar
    if (!node) return null;
    return (
      <div className="h-full overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-node-${node.type}/20 text-node-${node.type}`}>
                {TYPE_ICONS[node.type]}
              </div>
              <div>
                <h3 className="font-semibold text-foreground truncate max-w-[180px]">
                  {node.label}
                </h3>
                <p className="text-xs text-muted-foreground">{TYPE_LABELS[node.type]}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <FileCode className="w-3.5 h-3.5" />
              IFC Type
            </label>
            <div className="px-3 py-2 rounded-md bg-muted font-mono text-sm text-primary">
              {node.ifcType}
            </div>
          </div>

          {node.expressId && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Hash className="w-3.5 h-3.5" />
                Express ID
              </label>
              <div className="px-3 py-2 rounded-md bg-muted font-mono text-xs text-muted-foreground">
                #{node.expressId}
              </div>
            </div>
          )}

          {Object.keys(node.properties).length > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Tag className="w-3.5 h-3.5" />
                Properties
              </label>
              <div className="space-y-1">
                {Object.entries(node.properties).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50">
                    <span className="text-xs text-muted-foreground">{key}</span>
                    <span className="text-xs font-mono text-foreground">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="absolute top-4 right-4 w-80 bg-card/95 backdrop-blur-md rounded-xl border-glow overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-border bg-muted/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-node-${node.type}/20 text-node-${node.type}`}>
                  {TYPE_ICONS[node.type]}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground truncate max-w-[180px]">
                    {node.label}
                  </h3>
                  <p className="text-xs text-muted-foreground">{TYPE_LABELS[node.type]}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {/* IFC Type */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <FileCode className="w-3.5 h-3.5" />
                IFC Type
              </label>
              <div className="px-3 py-2 rounded-md bg-muted font-mono text-sm text-primary">
                {node.ifcType}
              </div>
            </div>

            {/* Node ID */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Hash className="w-3.5 h-3.5" />
                Node ID
              </label>
              <div className="px-3 py-2 rounded-md bg-muted font-mono text-xs text-muted-foreground">
                {node.id}
              </div>
            </div>

            {/* Express ID */}
            {node.expressId && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Hash className="w-3.5 h-3.5" />
                  Express ID
                </label>
                <div className="px-3 py-2 rounded-md bg-muted font-mono text-xs text-muted-foreground">
                  #{node.expressId}
                </div>
              </div>
            )}

            {/* Properties */}
            {Object.keys(node.properties).length > 0 && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Tag className="w-3.5 h-3.5" />
                  Properties
                </label>
                <div className="space-y-1">
                  {Object.entries(node.properties).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50"
                    >
                      <span className="text-xs text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className="text-xs font-mono text-foreground">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
