import { useState } from 'react';
import { toPng, toSvg, toCanvas } from 'html-to-image';
import { toast } from 'sonner';
import GIF from 'gif.js.optimized';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export function useFlowchartExport(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const downloadFile = (dataUrl: string | Blob, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = typeof dataUrl === 'string' ? dataUrl : URL.createObjectURL(dataUrl);
    link.click();
  };

  const exportPNG = async (title: string) => {
    if (!containerRef.current) return;
    setIsExporting(true);
    setExportProgress(100);
    try {
      const dataUrl = await toPng(containerRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      downloadFile(dataUrl, `${title || 'flowchart'}.png`);
      toast.success('Successfully exported as PNG');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PNG');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const exportSVG = async (title: string) => {
    if (!containerRef.current) return;
    setIsExporting(true);
    setExportProgress(100);
    try {
      const dataUrl = await toSvg(containerRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
      });
      downloadFile(dataUrl, `${title || 'flowchart'}.svg`);
      toast.success('Successfully exported as SVG');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export SVG');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const captureFrames = async (fps = 10, durationSecs = 3) => {
    if (!containerRef.current) return [];
    const frames: HTMLCanvasElement[] = [];
    const totalFrames = fps * durationSecs;
    const delay = 1000 / fps;

    for (let i = 0; i < totalFrames; i++) {
        const canvas = await toCanvas(containerRef.current, {
        cacheBust: true,
        pixelRatio: 1, // Keep lower ratio for video/gif to speed up encoding
        backgroundColor: '#ffffff',
      });
      frames.push(canvas);
      setExportProgress(Math.round(((i + 1) / totalFrames) * 50)); // First 50% is capturing
      await new Promise(r => setTimeout(r, delay));
    }
    return frames;
  };

  const exportGIF = async (title: string) => {
    if (!containerRef.current) return;
    setIsExporting(true);
    setExportProgress(0);
    try {
      toast.info('Rendering GIF, please wait...');
      const frames = await captureFrames(8, 2.5); // 8 fps for 2.5s (20 frames)

      const gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: 'https://cdn.jsdelivr.net/npm/gif.js.optimized@1.0.1/dist/gif.worker.js'
      });

      frames.forEach((canvas) => {
        gif.addFrame(canvas, { delay: 1000 / 8, copy: true });
      });

      gif.on('progress', (p: number) => {
        setExportProgress(50 + Math.round(p * 50));
      });

      gif.on('finished', (blob: Blob) => {
        downloadFile(blob, `${title || 'flowchart'}.gif`);
        toast.success('Successfully exported as GIF');
        setIsExporting(false);
        setExportProgress(0);
      });

      gif.render();
    } catch (err) {
      console.error(err);
      toast.error('Failed to export GIF');
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const exportMP4 = async (title: string) => {
    if (!containerRef.current) return;
    setIsExporting(true);
    setExportProgress(0);
    try {
      toast.info('Rendering MP4 video, please wait...');
      // Make sure VideoEncoder is supported
      if (typeof window === 'undefined' || !('VideoEncoder' in window)) {
        throw new Error('VideoEncoder not supported in this browser');
      }

      const frames = await captureFrames(15, 3); // 15 fps for 3s (45 frames)
      if (frames.length === 0) throw new Error('Failed to capture frames');
      
      const width = frames[0].width;
      const height = frames[0].height;

      // Ensure width/height are even numbers for h264
      const evenWidth = width % 2 === 0 ? width : width - 1;
      const evenHeight = height % 2 === 0 ? height : height - 1;

      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: evenWidth,
          height: evenHeight
        },
        fastStart: 'in-memory'
      });

      const videoEncoder = new window.VideoEncoder({
        output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
        error: (e: any) => console.error(e)
      });

      videoEncoder.configure({
        codec: 'avc1.42001f',
        width: evenWidth,
        height: evenHeight,
        bitrate: 2_500_000,
        framerate: 15
      });

      for (let i = 0; i < frames.length; i++) {
        const frameCanvas = frames[i];
        
        // If dimensions needed adjustment, draw to correctly sized canvas
        let targetCanvas = frameCanvas;
        if (width !== evenWidth || height !== evenHeight) {
           targetCanvas = document.createElement('canvas');
           targetCanvas.width = evenWidth;
           targetCanvas.height = evenHeight;
           const ctx = targetCanvas.getContext('2d');
           if (ctx) ctx.drawImage(frameCanvas, 0, 0, evenWidth, evenHeight);
        }

        const bitmap = await createImageBitmap(targetCanvas);
        const frame = new window.VideoFrame(bitmap, { timestamp: i * (1e6 / 15) });
        videoEncoder.encode(frame);
        frame.close();
        setExportProgress(50 + Math.round(((i + 1) / frames.length) * 50));
      }

      await videoEncoder.flush();
      muxer.finalize();

      const { buffer } = muxer.target as ArrayBufferTarget;
      const blob = new Blob([buffer], { type: 'video/mp4' });
      downloadFile(blob, `${title || 'flowchart'}.mp4`);
      toast.success('Successfully exported as MP4');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to export MP4', { description: err.message });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return {
    exportPNG,
    exportSVG,
    exportGIF,
    exportMP4,
    isExporting,
    exportProgress
  };
}
