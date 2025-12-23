import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileCode, Loader2 } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  progress?: number;
  progressMessage?: string;
}

export function FileUpload({ onFileSelect, isLoading, progress = 0, progressMessage = '' }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && (file.name.toLowerCase().endsWith('.ifc') || file.name.toLowerCase().endsWith('.ifcx'))) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`
        relative w-full max-w-xl p-8 rounded-xl border-2 border-dashed transition-all duration-300
        ${isDragging 
          ? 'border-primary bg-primary/10 glow-primary' 
          : 'border-border hover:border-primary/50 bg-card/50'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept=".ifc,.ifcx"
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isLoading}
      />

      <div className="flex flex-col items-center gap-4 text-center">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, rotate: 0 }}
              animate={{ opacity: 1, rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{ rotate: { duration: 1, repeat: Infinity, ease: 'linear' } }}
            >
              <Loader2 className="w-12 h-12 text-primary" />
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-full transition-colors ${
                isDragging ? 'bg-primary/20' : 'bg-muted'
              }`}
            >
              {isDragging ? (
                <FileCode className="w-12 h-12 text-primary" />
              ) : (
                <Upload className="w-12 h-12 text-muted-foreground" />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {isLoading ? 'Parsing IFC file...' : 'Upload IFC File'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? progressMessage || 'Extracting entities and relationships'
              : 'Drag and drop or click to browse'}
          </p>
        </div>

        {isLoading && progress > 0 && (
          <div className="w-full max-w-xs">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-mono text-muted-foreground">Progress</span>
              <span className="text-xs font-mono font-semibold text-primary">{progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
                className="h-full bg-primary rounded-full"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs font-mono text-muted-foreground">
          <FileCode className="w-3.5 h-3.5" />
          <span>.ifc files supported</span>
        </div>
      </div>

      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-xl bg-primary/5 pointer-events-none"
        />
      )}
    </motion.div>
  );
}
