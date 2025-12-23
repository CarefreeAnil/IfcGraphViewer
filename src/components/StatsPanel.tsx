import { motion } from 'framer-motion';
import { FileCode, Box, Link2, Clock, HardDrive } from 'lucide-react';
import { ParsedIFCData } from '@/types/graph';

interface StatsPanelProps {
  metadata: ParsedIFCData['metadata'];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime(ms: number): string {
  if (ms < 1000) return ms.toFixed(0) + 'ms';
  return (ms / 1000).toFixed(2) + 's';
}

export function StatsPanel({ metadata }: StatsPanelProps) {
  const stats = [
    { icon: <FileCode className="w-4 h-4" />, label: 'File', value: metadata.fileName },
    { icon: <HardDrive className="w-4 h-4" />, label: 'Size', value: formatBytes(metadata.fileSize) },
    { icon: <Box className="w-4 h-4" />, label: 'Entities', value: metadata.entityCount.toLocaleString() },
    { icon: <Link2 className="w-4 h-4" />, label: 'Relations', value: metadata.relationshipCount.toLocaleString() },
    { icon: <Clock className="w-4 h-4" />, label: 'Parse Time', value: formatTime(metadata.parseTime) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-4 left-4 flex gap-4 p-4 rounded-lg bg-card/95 backdrop-blur-md border-glow"
    >
      {stats.map(({ icon, label, value }) => (
        <div key={label} className="flex items-center gap-2">
          <div className="text-primary">{icon}</div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
            <span className="text-sm font-mono text-foreground">{value}</span>
          </div>
        </div>
      ))}
    </motion.div>
  );
}
