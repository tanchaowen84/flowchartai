'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { FlowchartAiMetadata } from '@/lib/diagram/contracts';
import { cn } from '@/lib/utils';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { AlertCircle, Check, XIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

interface CanvasExportModalProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
  flowchartAiMetadata: FlowchartAiMetadata;
  onClose: () => void;
  title: string;
}

const formats = [
  {
    id: 'png',
    title: 'PNG Image',
    description: 'Perfect for web sharing, documents, and presentations',
  },
  {
    id: 'svg',
    title: 'SVG Vector',
    description: 'Scalable format, ideal for editing and high-quality exports',
  },
  {
    id: 'json',
    title: 'Excalidraw File',
    description: 'Native format for editing in Excalidraw later',
  },
] as const;

type ExportFormat = (typeof formats)[number]['id'];

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

export default function CanvasExportModal({
  excalidrawAPI,
  flowchartAiMetadata,
  onClose,
  title,
}: CanvasExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const exportCanvas = async (): Promise<void> => {
    setIsExporting(true);
    setStatus('idle');
    setError('');
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      if (elements.length === 0) {
        throw new Error(
          'Canvas is empty. Please draw something before exporting.'
        );
      }

      let blob: Blob;
      let filename: string;
      if (selectedFormat === 'png') {
        const { exportToBlob } = await import('@excalidraw/excalidraw');
        blob = await exportToBlob({
          elements,
          appState: {
            ...appState,
            exportBackground: true,
            exportWithDarkMode: false,
          },
          files,
          mimeType: 'image/png',
          quality: 0.92,
          exportPadding: 20,
        });
        filename = `${title || 'flowchart'}.png`;
      } else if (selectedFormat === 'svg') {
        const { exportToSvg } = await import('@excalidraw/excalidraw');
        const svg = await exportToSvg({
          elements,
          appState: {
            ...appState,
            exportBackground: true,
            exportWithDarkMode: false,
          },
          files,
          exportPadding: 20,
        });
        blob = new Blob([new XMLSerializer().serializeToString(svg)], {
          type: 'image/svg+xml',
        });
        filename = `${title || 'flowchart'}.svg`;
      } else {
        const { collaborators, ...cleanAppState } = appState;
        blob = new Blob(
          [
            JSON.stringify(
              {
                type: 'excalidraw',
                version: 2,
                source: 'https://excalidraw.com',
                elements,
                appState: cleanAppState,
                files,
                flowchartAi: flowchartAiMetadata,
              },
              null,
              2
            ),
          ],
          { type: 'application/json' }
        );
        filename = `${title || 'flowchart'}.excalidraw`;
      }

      downloadBlob(blob, filename);
      setStatus('success');
      window.setTimeout(onClose, 1000);
    } catch (exportError) {
      setStatus('error');
      setError(
        exportError instanceof Error ? exportError.message : 'Export failed'
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative mx-4 w-full max-w-md rounded-xl border-2 border-white bg-white shadow-xl md:mx-0"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="absolute -top-16 right-0 rounded-full bg-neutral-900/50 p-2 text-white ring-1 backdrop-blur-md hover:bg-neutral-900/70"
          onClick={onClose}
        >
          <XIcon className="size-5" />
        </button>

        <div className="p-5">
          <div className="pb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Export Flowchart
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Choose your preferred export format
            </p>
          </div>

          {status === 'success' && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-2 text-sm font-medium text-green-800">
              <Check className="h-4 w-4" /> Export successful!
            </div>
          )}
          {status === 'error' && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm font-medium text-red-800">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          <div className="grid gap-2 pb-4">
            {formats.map((format) => (
              <Card
                key={format.id}
                className={cn(
                  'cursor-pointer transition-all duration-200 hover:shadow-sm',
                  selectedFormat === format.id
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                )}
                onClick={() => setSelectedFormat(format.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {format.title}
                      </h3>
                      <p className="mt-1 text-xs text-gray-600">
                        {format.description}
                      </p>
                    </div>
                    {selectedFormat === format.id && (
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isExporting}>
              Cancel
            </Button>
            <Button
              onClick={exportCanvas}
              disabled={isExporting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isExporting
                ? 'Exporting…'
                : `Export ${formats.find((format) => format.id === selectedFormat)?.title}`}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
