/**
 * Learn Page
 * Simple, linear learning path for IFC beginners
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { EDUCATIONAL_SAMPLES, EducationalSample } from '@/features/educational/data/educationalSamples';
import { SampleCard } from '@/features/educational/components/SampleCard';
import { IFCArchitectureDiagram } from '@/features/educational/components/IFCArchitectureDiagram';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function Learn() {
  const navigate = useNavigate();
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
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Learn IFC</h1>
                <p className="text-sm text-muted-foreground">Step-by-step introduction to BIM and IFC</p>
              </div>
            </div>

            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Back to Main App
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Lightbulb className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground">
                  Explore IFC Models
                </h2>
                <p className="text-muted-foreground">
                  IFC (Industry Foundation Classes) is an open standard for sharing BIM data. Browse real IFC models to understand the structure and concepts behind building information modeling. No prior knowledge required.
                </p>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>Load any sample model to explore its entities, relationships, and properties in detail</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* IFC Architecture (Collapsible) */}
        <Card>
          <button
            onClick={() => setShowArchitecture(!showArchitecture)}
            className="w-full text-left"
          >
            <CardHeader className="pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <CardTitle>IFC Schema Architecture</CardTitle>
              </div>
              {showArchitecture ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
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

        {/* Sample Models */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Sample Models</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Explore different IFC models to understand various concepts and structures
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      </main>
    </div>
  );
}
