/**
 * Learn Page
 * Simple, linear learning path for IFC beginners
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, ChevronDown, ChevronUp, Moon, Sun } from 'lucide-react';
import { EDUCATIONAL_SAMPLES, EducationalSample } from '@/features/educational/data/educationalSamples';
import { SampleCard } from '@/features/educational/components/SampleCard';
import { IFCArchitectureDiagram } from '@/features/educational/components/IFCArchitectureDiagram';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIState } from '@/contexts/UIStateContext';

export default function Learn() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useUIState();
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [showArchitecture, setShowArchitecture] = useState(false);

  const handleLoadSample = async (sample: EducationalSample) => {
    try {
      setLoadingSampleId(sample.id);

      const response = await fetch(sample.path);
      if (!response.ok) {
        throw new Error(`Failed to load sample: ${response.statusText}`);
      }

      const blob = await response.blob();
      const fileName = sample.path.split('/').pop() || `${sample.id}.ifc`;
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });

      navigate('/', {
        state: {
          sampleFile: file,
          learningSample: sample,
          learningMode: true,
        }
      });

      toast.success(`Loading ${sample.name}...`);
    } catch (error) {
      console.error('Error loading sample:', error);
      toast.error('Failed to load sample file. Please check the file path.');
    } finally {
      setLoadingSampleId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/25 bg-primary/10">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Learn IFC</h1>
                <p className="text-sm text-muted-foreground">Step-by-step introduction to BIM and IFC</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/70 text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                aria-pressed={theme === 'light'}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                onClick={() => navigate('/')}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Back to Main App
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <Card className="border-primary/20 bg-primary/[0.04]">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Explore IFC Models</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a model to inspect its structure, relationships, and properties.
              </p>
            </div>
            <BookOpen className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
          </CardContent>
        </Card>

        {/* Sample Models */}
        <Card className="border-primary/20 bg-card">
          <CardHeader className="pb-4">
            <CardTitle>Sample Models</CardTitle>
            <p className="text-sm text-muted-foreground">Choose a model to begin.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {EDUCATIONAL_SAMPLES.map((sample) => (
                <SampleCard
                  key={sample.id}
                  sample={sample}
                  onLoadSample={handleLoadSample}
                  isLoading={loadingSampleId === sample.id}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* IFC Architecture (Collapsible) */}
        <Card>
          <button onClick={() => setShowArchitecture(!showArchitecture)} className="w-full text-left">
            <CardHeader className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <CardTitle>IFC Schema Architecture</CardTitle>
              </div>
              {showArchitecture ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </CardHeader>
          </button>
          <AnimatePresence>
            {showArchitecture && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <CardContent className="pt-0">
                  <IFCArchitectureDiagram compact={false} />
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </main>
    </div>
  );
}
