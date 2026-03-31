import { useState } from 'react';
import { toCanvas, toSvg } from 'html-to-image';
import { toast } from 'sonner';
import GIF from 'gif.js.optimized';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Walk an (orig, clone) pair and copy the browser's current computed values for
 * the properties that Framer-Motion / WAAPI animate (transform, opacity) plus
 * CSS-only SVG presentation props (stroke, stroke-width from Tailwind classes).
 * We deliberately skip "fill" when it is already an SVG url() reference, and
 * skip "filter" so that the svg filter="url(#…)" attribute is preserved.
 */
function inlineSVGStyles(orig: Element, clone: Element): void {
  if (!(orig instanceof SVGElement || orig instanceof HTMLElement)) return;

  const cs = getComputedStyle(orig as HTMLElement);
  const cl = clone as HTMLElement;

  // Framer-Motion / WAAPI animated values
  const transform = cs.getPropertyValue('transform');
  if (transform && transform !== 'none') {
    cl.style.setProperty('transform', transform);
    const to = cs.getPropertyValue('transform-origin');
    if (to) cl.style.setProperty('transform-origin', to);
  }
  const opacity = cs.getPropertyValue('opacity');
  if (opacity !== '1') cl.style.setProperty('opacity', opacity);

  // Stroke / stroke-width set only via Tailwind CSS classes (not via SVG attrs)
  const svgOrig = orig as SVGElement;
  if (!svgOrig.hasAttribute('stroke')) {
    const sv = cs.getPropertyValue('stroke');
    if (sv && sv !== 'none' && sv !== '') cl.style.setProperty('stroke', sv);
  }
  if (!svgOrig.hasAttribute('stroke-width')) {
    const swv = cs.getPropertyValue('stroke-width');
    if (swv) cl.style.setProperty('stroke-width', swv);
  }

  // Recurse – but never descend into <foreignObject>; those become <image> elements
  if (orig.tagName.toLowerCase() !== 'foreignobject') {
    const oc = [...orig.children];
    const cc = [...clone.children];
    for (let i = 0; i < Math.min(oc.length, cc.length); i++) {
      inlineSVGStyles(oc[i], cc[i]);
    }
  }
}

/**
 * Capture an SVG-based container to a canvas without the nested-foreignObject
 * bug:
 *   1. Pre-rasterise each <foreignObject> into a PNG data-URL using a
 *      *position:fixed, top:0, left:0* temp-div so html-to-image renders it
 *      normally (not off-screen).
 *   2. Clone the <svg>, inline computed transforms/stroke/opacity, replace every
 *      <foreignObject> with an <image href="data:…">.
 *   3. Serialise the clean SVG → Blob URL → <img> → canvas.  No html-to-image
 *      foreignObject wrapper is involved, so there is no nesting.
 */
async function captureToCanvas(
  container: HTMLElement,
  pixelRatio = 2,
): Promise<HTMLCanvasElement> {
  const svgEl = container.querySelector('svg') as SVGElement | null;

  // ── No SVG: fall back to html-to-image directly (no nested-FO risk) ─────────
  if (!svgEl) {
    return toCanvas(container, {
      cacheBust: true,
      pixelRatio,
      backgroundColor: '#ffffff',
    });
  }

  const svgRect = svgEl.getBoundingClientRect();
  const W = Math.round(svgRect.width);
  const H = Math.round(svgRect.height);
  if (!W || !H) throw new Error('[export] SVG has zero dimensions');

  // ── Step 1: pre-render each <foreignObject> ──────────────────────────────────
  const origFOs = [...svgEl.querySelectorAll('foreignObject')];
  const foImages: {
    idx: number; x: string; y: string; w: string; h: string; dataUrl: string;
  }[] = [];

  for (let i = 0; i < origFOs.length; i++) {
    const fo = origFOs[i];
    const fw = parseFloat(fo.getAttribute('width') || '0');
    const fh = parseFloat(fo.getAttribute('height') || '0');
    if (fw < 1 || fh < 1) continue;

    // Position at (0,0) so html-to-image sees it as in-viewport → correct render
    const tmp = document.createElement('div');
    Object.assign(tmp.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: `${fw}px`,
      height: `${fh}px`,
      overflow: 'hidden',
      zIndex: '-99999',        // behind everything, not user-visible
      pointerEvents: 'none',
    });
    for (const child of fo.children) tmp.appendChild(child.cloneNode(true));
    document.body.appendChild(tmp);

    let dataUrl = '';
    try {
      const fc = await toCanvas(tmp, {
        width: fw,
        height: fh,
        pixelRatio,
        cacheBust: true,
        backgroundColor: null as unknown as string,
      });
      dataUrl = fc.toDataURL('image/png');
    } catch (e) {
      console.warn('[export] foreignObject pre-render failed', e);
    } finally {
      document.body.removeChild(tmp);
    }

    if (dataUrl) {
      foImages.push({
        idx: i,
        x: fo.getAttribute('x') || '0',
        y: fo.getAttribute('y') || '0',
        w: String(fw),
        h: String(fh),
        dataUrl,
      });
    }
  }

  // ── Step 2: clone SVG + inline animated styles ───────────────────────────────
  const svgClone = svgEl.cloneNode(true) as SVGElement;
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgClone.setAttribute('width', String(W));
  svgClone.setAttribute('height', String(H));
  inlineSVGStyles(svgEl, svgClone);

  // ── Step 3: swap <foreignObject> → <image> in the clone ─────────────────────
  const cloneFOs = [...svgClone.querySelectorAll('foreignObject')];
  for (const r of foImages) {
    if (r.idx >= cloneFOs.length) continue;
    const imgEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    imgEl.setAttribute('x', r.x);
    imgEl.setAttribute('y', r.y);
    imgEl.setAttribute('width', r.w);
    imgEl.setAttribute('height', r.h);
    imgEl.setAttribute('href', r.dataUrl);
    cloneFOs[r.idx].parentNode?.replaceChild(imgEl, cloneFOs[r.idx]);
  }

  // ── Step 4: serialise → Blob URL → <img> → canvas ────────────────────────────
  const serialiser = new XMLSerializer();
  let svgStr = serialiser.serializeToString(svgClone);
  // Ensure the SVG namespace is declared (XMLSerializer may omit it)
  if (!svgStr.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgStr = svgStr.replace(/^<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  const canvas = document.createElement('canvas');
  canvas.width = W * pixelRatio;
  canvas.height = H * pixelRatio;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('[export] SVG → image render failed'));
    };
    img.src = blobUrl;
  });

  return canvas;
}

// ─── hook ────────────────────────────────────────────────────────────────────

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
      const canvas = await captureToCanvas(containerRef.current, 2);
      setExportProgress(100);
      downloadFile(canvas.toDataURL('image/png'), `${title || 'flowchart'}.png`);
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

  const captureFrames = async (fps = 10, durationSecs = 3): Promise<HTMLCanvasElement[]> => {
    if (!containerRef.current) return [];
    const frames: HTMLCanvasElement[] = [];
    const totalFrames = fps * durationSecs;
    const delay = 1000 / fps;

    for (let i = 0; i < totalFrames; i++) {
      const canvas = await captureToCanvas(containerRef.current, 1);
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
      toast.info('Rendering GIF, please wait…');
      const frames = await captureFrames(8, 2.5); // 20 frames
      if (!frames.length) throw new Error('No frames captured');

      const gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: '/gif.worker.js', // served from public/
      });

      for (const frame of frames) gif.addFrame(frame, { delay: 125, copy: true });

      gif.on('progress', (p: number) => setExportProgress(50 + Math.round(p * 50)));
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
      toast.info('Rendering MP4, please wait…');
      if (typeof window === 'undefined' || !('VideoEncoder' in window)) {
        throw new Error('VideoEncoder API not supported in this browser');
      }

      const frames = await captureFrames(15, 3); // 45 frames
      if (!frames.length) throw new Error('No frames captured');

      const width = frames[0].width;
      const height = frames[0].height;
      const evenW = width % 2 === 0 ? width : width - 1;
      const evenH = height % 2 === 0 ? height : height - 1;

      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'avc', width: evenW, height: evenH },
        fastStart: 'in-memory',
      });

      const videoEncoder = new (window as any).VideoEncoder({
        output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
        error: (e: any) => console.error(e),
      });
      videoEncoder.configure({
        codec: 'avc1.42001f',
        width: evenW,
        height: evenH,
        bitrate: 2_500_000,
        framerate: 15,
      });

      for (let i = 0; i < frames.length; i++) {
        let src = frames[i];
        if (width !== evenW || height !== evenH) {
          src = document.createElement('canvas');
          src.width = evenW;
          src.height = evenH;
          src.getContext('2d')?.drawImage(frames[i], 0, 0, evenW, evenH);
        }
        const bitmap = await createImageBitmap(src);
        const frame = new (window as any).VideoFrame(bitmap, {
          timestamp: i * (1_000_000 / 15),
        });
        videoEncoder.encode(frame);
        frame.close();
        bitmap.close();
        setExportProgress(50 + Math.round(((i + 1) / frames.length) * 50));
      }

      await videoEncoder.flush();
      muxer.finalize();

      const { buffer } = muxer.target as ArrayBufferTarget;
      downloadFile(new Blob([buffer], { type: 'video/mp4' }), `${title || 'flowchart'}.mp4`);
      toast.success('Successfully exported as MP4');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to export MP4', { description: err.message });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return { exportPNG, exportSVG, exportGIF, exportMP4, isExporting, exportProgress };
}
