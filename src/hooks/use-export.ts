import { useState } from 'react';
import { toPng, toSvg, toCanvas } from 'html-to-image';
import { toast } from 'sonner';
import GIF from 'gif.js.optimized';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/**
 * Pre-renders all SVG <foreignObject> elements in a cloned container to
 * inline SVG <image> data URLs.  This prevents the "nested foreignObject"
 * bug in html-to-image where foreignObject inside SVG inside the outer
 * foreignObject wrapper fails to render in Chromium-based browsers.
 */
async function resolveForeignObjects(container: HTMLElement): Promise<void> {
  const foreignObjects = Array.from(container.querySelectorAll('svg foreignObject'));
  if (foreignObjects.length === 0) return;

  for (const fo of foreignObjects) {
    const width = parseFloat(fo.getAttribute('width') || '0');
    const height = parseFloat(fo.getAttribute('height') || '0');
    if (!width || !height) continue;

    // Build a same-document temp div so CSS (Tailwind) is applied
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = `position:fixed;top:-99999px;left:-99999px;width:${width}px;height:${height}px;overflow:hidden;background:transparent;`;
    const inner = fo.firstElementChild;
    if (inner) tempDiv.appendChild(inner.cloneNode(true));
    document.body.appendChild(tempDiv);

    let dataUrl: string | null = null;
    try {
      const foCanvas = await toCanvas(tempDiv, {
        width,
        height,
        pixelRatio: 2,
        backgroundColor: null as any,
        cacheBust: true,
      });
      dataUrl = foCanvas.toDataURL('image/png');
    } catch {
      // If inner capture fails, leave the foreignObject in place
    } finally {
      document.body.removeChild(tempDiv);
    }

    if (!dataUrl) continue;

    const x = fo.getAttribute('x') || '0';
    const y = fo.getAttribute('y') || '0';
    const imageEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    imageEl.setAttribute('x', x);
    imageEl.setAttribute('y', y);
    imageEl.setAttribute('width', String(width));
    imageEl.setAttribute('height', String(height));
    imageEl.setAttribute('href', dataUrl);
    fo.parentNode?.replaceChild(imageEl, fo);
  }
}

/**
 * Captures the container to a canvas, working around the nested-foreignObject
 * rendering bug in html-to-image by pre-rasterising all SVG foreignObjects.
 */
async function captureContainerToCanvas(
  container: HTMLElement,
  pixelRatio = 2,
): Promise<HTMLCanvasElement> {
  // Deep-clone so we never mutate the live DOM
  const clone = container.cloneNode(true) as HTMLElement;
  const rect = container.getBoundingClientRect();
  clone.style.cssText += `;position:fixed;top:-99999px;left:-99999px;width:${rect.width}px;height:${rect.height}px;`;
  document.body.appendChild(clone);

  try {
    // Replace foreignObjects with pre-rendered images in the clone
    await resolveForeignObjects(clone);

    return await toCanvas(clone, {
      cacheBust: true,
      pixelRatio,
      backgroundColor: '#ffffff',
      width: rect.width,
      height: rect.height,
    });
  } finally {
    document.body.removeChild(clone);
  }
}

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
    setExportProgress(20);
    try {
      const canvas = await captureContainerToCanvas(containerRef.current, 2);
      setExportProgress(100);
      const dataUrl = canvas.toDataURL('image/png');
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
      const canvas = await captureContainerToCanvas(containerRef.current, 1);
      frames.push(canvas);
      setExportProgress(Math.round(((i + 1) / totalFrames) * 50));
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
      const frames = await captureFrames(8, 2.5); // 8 fps for 2.5 s (20 frames)
      if (frames.length === 0) throw new Error('Failed to capture frames');

      const gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: '/gif.worker.js', // served from public/
      });

      for (const canvas of frames) {
        gif.addFrame(canvas, { delay: 1000 / 8, copy: true });
      }

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
      if (typeof window === 'undefined' || !('VideoEncoder' in window)) {
        throw new Error('VideoEncoder not supported in this browser');
      }

      const frames = await captureFrames(15, 3); // 15 fps for 3 s (45 frames)
      if (frames.length === 0) throw new Error('Failed to capture frames');

      const width = frames[0].width;
      const height = frames[0].height;

      // H.264 requires even dimensions
      const evenWidth = width % 2 === 0 ? width : width - 1;
      const evenHeight = height % 2 === 0 ? height : height - 1;

      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'avc', width: evenWidth, height: evenHeight },
        fastStart: 'in-memory',
      });

      const videoEncoder = new window.VideoEncoder({
        output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
        error: (e: any) => console.error(e),
      });

      videoEncoder.configure({
        codec: 'avc1.42001f',
        width: evenWidth,
        height: evenHeight,
        bitrate: 2_500_000,
        framerate: 15,
      });

      for (let i = 0; i < frames.length; i++) {
        let targetCanvas = frames[i];
        if (width !== evenWidth || height !== evenHeight) {
          targetCanvas = document.createElement('canvas');
          targetCanvas.width = evenWidth;
          targetCanvas.height = evenHeight;
          const ctx = targetCanvas.getContext('2d');
          if (ctx) ctx.drawImage(frames[i], 0, 0, evenWidth, evenHeight);
        }

        const bitmap = await createImageBitmap(targetCanvas);
        const frame = new window.VideoFrame(bitmap, { timestamp: i * (1e6 / 15) });
        videoEncoder.encode(frame);
        frame.close();
        bitmap.close();
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
    exportProgress,
  };
}
