import { useState } from 'react';
import { domToCanvas, domToDataUrl } from 'modern-screenshot';
import { toast } from 'sonner';
import GIF from 'gif.js.optimized';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

// ─── size presets ─────────────────────────────────────────────────────────────

export type ExportPreset =
  | 'original'
  | 'square'
  | 'story'
  | 'portrait'
  | 'landscape'
  | 'widescreen';

export const EXPORT_PRESETS: Record<
  ExportPreset,
  { label: string; w?: number; h?: number }
> = {
  original: { label: 'Original size' },
  square: { label: '1:1 Square (1080×1080)', w: 1080, h: 1080 },
  story: { label: '9:16 Story (1080×1920)', w: 1080, h: 1920 },
  portrait: { label: '4:5 Portrait (1080×1350)', w: 1080, h: 1350 },
  landscape: { label: '16:9 Landscape (1920×1080)', w: 1920, h: 1080 },
  widescreen: { label: '4:3 Widescreen (1440×1080)', w: 1440, h: 1080 },
};

// ─── watermark ────────────────────────────────────────────────────────────────

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const fontSize = Math.max(14, Math.round(Math.min(w, h) * 0.022));
  const pad = Math.round(fontSize * 1.1);
  const text = 'infogiph.com';
  ctx.save();
  ctx.font = `600 ${fontSize}px Geist, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  const tw = ctx.measureText(text).width;
  const bw = tw + pad;
  const bh = fontSize + pad * 0.5;
  const bx = w - bw - pad * 0.6;
  const by = h - bh - pad * 0.6;
  const r = Math.min(bh / 2, 10);
  ctx.fillStyle = 'rgba(15,23,42,0.72)';
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
  ctx.lineTo(bx + bw, by + bh - r);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
  ctx.lineTo(bx + r, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(text, bx + bw - pad * 0.5, by + bh - pad * 0.25);
  ctx.restore();
}

// ─── finalise (preset + watermark) ────────────────────────────────────────────

function finaliseCanvas(
  source: HTMLCanvasElement,
  preset: ExportPreset,
): HTMLCanvasElement {
  const p = EXPORT_PRESETS[preset];
  const target = document.createElement('canvas');
  target.width = p.w ?? source.width;
  target.height = p.h ?? source.height;
  const ctx = target.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, target.width, target.height);
  const scale = Math.min(
    target.width / source.width,
    target.height / source.height,
  );
  const dw = source.width * scale;
  const dh = source.height * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    source,
    (target.width - dw) / 2,
    (target.height - dh) / 2,
    dw,
    dh,
  );
  drawWatermark(ctx, target.width, target.height);
  return target;
}

// ─── capture helpers ──────────────────────────────────────────────────────────

async function capture(el: HTMLElement, scale = 2): Promise<HTMLCanvasElement> {
  return domToCanvas(el, {
    scale,
    backgroundColor: '#ffffff',
    debug: false,
  });
}

// SMIL properties that we inline onto parents so the serialised DOM reflects
// the animation state at time `t`.
const SMIL_PROPS = [
  'transform',
  'opacity',
  'cx',
  'cy',
  'r',
  'x',
  'y',
  'stroke-dashoffset',
  'stroke-dasharray',
  'fill-opacity',
  'stroke-opacity',
];

type Saved = {
  el: Element;
  parent: Element;
  origDisplay: string;
  inlined: { prop: string; orig: string }[];
};

function collectSMIL(svg: SVGSVGElement): Saved[] {
  const out: Saved[] = [];
  svg
    .querySelectorAll('animate, animateMotion, animateTransform')
    .forEach((el) => {
      const parent = el.parentElement;
      if (parent) {
        out.push({
          el,
          parent,
          origDisplay: (el as HTMLElement).style.display,
          inlined: [],
        });
      }
    });
  return out;
}

function inlineSMIL(entries: Saved[]) {
  for (const e of entries) {
    const cs = getComputedStyle(e.parent as HTMLElement);
    e.inlined = [];
    for (const prop of SMIL_PROPS) {
      const val = cs.getPropertyValue(prop);
      if (val && val !== '' && val !== 'none' && val !== '0') {
        const orig = (e.parent as HTMLElement).style.getPropertyValue(prop);
        (e.parent as HTMLElement).style.setProperty(prop, val);
        e.inlined.push({ prop, orig });
      }
    }
    (e.el as HTMLElement).style.display = 'none';
  }
}

function restoreSMIL(entries: Saved[]) {
  for (const e of entries) {
    for (const { prop, orig } of e.inlined) {
      if (orig) {
        (e.parent as HTMLElement).style.setProperty(prop, orig);
      } else {
        (e.parent as HTMLElement).style.removeProperty(prop);
      }
    }
    (e.el as HTMLElement).style.display = e.origDisplay;
    e.inlined = [];
  }
}

// ─── hook ────────────────────────────────────────────────────────────────────

export function useFlowchartExport(
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const download = (data: string | Blob, filename: string) => {
    const a = document.createElement('a');
    a.download = filename;
    a.href = typeof data === 'string' ? data : URL.createObjectURL(data);
    a.click();
    if (typeof data !== 'string') setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  };

  // ── PNG ──────────────────────────────────────────────────────────────────────

  const exportPNG = async (title: string, preset: ExportPreset = 'original') => {
    if (!containerRef.current) return;
    setIsExporting(true);
    setExportProgress(20);
    try {
      const raw = await capture(containerRef.current, 3);
      const out = finaliseCanvas(raw, preset);
      setExportProgress(100);
      download(out.toDataURL('image/png'), `${title || 'infogiph'}.png`);
      toast.success('PNG exported');
    } catch (err) {
      console.error('[export:png]', err);
      toast.error('Failed to export PNG');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // ── SVG ──────────────────────────────────────────────────────────────────────

  const exportSVG = async (title: string, preset: ExportPreset = 'original') => {
    if (!containerRef.current) return;
    setIsExporting(true);
    setExportProgress(40);
    try {
      const dataUrl = await domToDataUrl(containerRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('SVG decode failed'));
        img.src = dataUrl;
      });
      const raw = document.createElement('canvas');
      raw.width = img.naturalWidth || containerRef.current.clientWidth * 2;
      raw.height = img.naturalHeight || containerRef.current.clientHeight * 2;
      raw.getContext('2d')?.drawImage(img, 0, 0, raw.width, raw.height);
      const out = finaliseCanvas(raw, preset);

      const wrapper = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${out.width}" height="${out.height}" viewBox="0 0 ${out.width} ${out.height}">
  <image width="${out.width}" height="${out.height}" href="${out.toDataURL('image/png')}" />
</svg>`;
      download(
        new Blob([wrapper], { type: 'image/svg+xml;charset=utf-8' }),
        `${title || 'infogiph'}.svg`,
      );
      setExportProgress(100);
      toast.success('SVG exported');
    } catch (err) {
      console.error('[export:svg]', err);
      toast.error('Failed to export SVG');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // ── Frame capture (deterministic SMIL seek) ─────────────────────────────────

  const captureFrames = async (
    fps: number,
    durationSecs: number,
  ): Promise<HTMLCanvasElement[]> => {
    if (!containerRef.current) return [];
    const container = containerRef.current;
    const svg = container.querySelector('svg') as SVGSVGElement | null;

    const canSeek =
      svg &&
      typeof svg.pauseAnimations === 'function' &&
      typeof svg.setCurrentTime === 'function' &&
      typeof svg.unpauseAnimations === 'function';

    const total = Math.round(fps * durationSecs);
    const frames: HTMLCanvasElement[] = [];
    const entries = svg ? collectSMIL(svg) : [];

    if (canSeek) svg!.pauseAnimations();

    try {
      for (let i = 0; i < total; i++) {
        if (canSeek) {
          svg!.setCurrentTime(i / fps);
          await raf();
          await raf();
          inlineSMIL(entries);
        } else {
          await delay(1000 / fps);
        }
        frames.push(await capture(container, 2));
        if (canSeek) restoreSMIL(entries);
        setExportProgress(Math.round(((i + 1) / total) * 50));
      }
    } finally {
      if (canSeek) {
        restoreSMIL(entries);
        svg!.unpauseAnimations();
      }
    }
    return frames;
  };

  // ── GIF ──────────────────────────────────────────────────────────────────────

  const exportGIF = async (title: string, preset: ExportPreset = 'original') => {
    if (!containerRef.current) return;
    setIsExporting(true);
    setExportProgress(0);
    try {
      toast.info('Rendering GIF — this may take a moment…');
      const FPS = 12;
      const DUR = 3;
      const rawFrames = await captureFrames(FPS, DUR);
      if (!rawFrames.length) throw new Error('No frames captured');
      const frames = rawFrames.map((f) => finaliseCanvas(f, preset));

      const gif = new GIF({
        workers: 2,
        quality: 8,
        width: frames[0].width,
        height: frames[0].height,
        workerScript: '/gif.worker.js',
      });

      for (const f of frames) gif.addFrame(f, { delay: Math.round(1000 / FPS), copy: true });

      gif.on('progress', (p: number) => setExportProgress(50 + Math.round(p * 50)));
      gif.on('finished', (blob: Blob) => {
        download(blob, `${title || 'infogiph'}.gif`);
        toast.success('GIF exported');
        setIsExporting(false);
        setExportProgress(0);
      });
      gif.render();
    } catch (err) {
      console.error('[export:gif]', err);
      toast.error('Failed to export GIF');
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // ── MP4 ──────────────────────────────────────────────────────────────────────

  const exportMP4 = async (title: string, preset: ExportPreset = 'original') => {
    if (!containerRef.current) return;
    setIsExporting(true);
    setExportProgress(0);
    try {
      toast.info('Rendering MP4 — this may take a moment…');
      if (typeof window === 'undefined' || !('VideoEncoder' in window)) {
        throw new Error('MP4 export requires Chrome or Edge (WebCodecs API)');
      }

      const FPS = 24;
      const DUR = 3;
      const rawFrames = await captureFrames(FPS, DUR);
      if (!rawFrames.length) throw new Error('No frames captured');
      const frames = rawFrames.map((f) => finaliseCanvas(f, preset));

      const w = frames[0].width;
      const h = frames[0].height;
      const evenW = w - (w % 2);
      const evenH = h - (h % 2);
      const area = evenW * evenH;

      let codec = 'avc1.42001f';
      if (area > 921_600) codec = 'avc1.420028';
      if (area > 2_097_152) codec = 'avc1.42002a';
      if (area > 2_359_296) codec = 'avc1.420033';

      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'avc', width: evenW, height: evenH },
        fastStart: 'in-memory',
      });

      const encoder = new (window as any).VideoEncoder({
        output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
        error: (e: any) => console.error(e),
      });
      encoder.configure({
        codec,
        width: evenW,
        height: evenH,
        bitrate: 8_000_000,
        framerate: FPS,
      });

      for (let i = 0; i < frames.length; i++) {
        let src = frames[i];
        if (w !== evenW || h !== evenH) {
          src = document.createElement('canvas');
          src.width = evenW;
          src.height = evenH;
          src.getContext('2d')?.drawImage(frames[i], 0, 0, evenW, evenH);
        }
        const bitmap = await createImageBitmap(src);
        const vf = new (window as any).VideoFrame(bitmap, {
          timestamp: i * (1_000_000 / FPS),
        });
        encoder.encode(vf, { keyFrame: i % FPS === 0 });
        vf.close();
        bitmap.close();
        setExportProgress(50 + Math.round(((i + 1) / frames.length) * 50));
      }

      await encoder.flush();
      muxer.finalize();

      const { buffer } = muxer.target as ArrayBufferTarget;
      download(
        new Blob([buffer], { type: 'video/mp4' }),
        `${title || 'infogiph'}.mp4`,
      );
      toast.success('MP4 exported');
    } catch (err: any) {
      console.error('[export:mp4]', err);
      toast.error('Failed to export MP4', { description: err.message });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return { exportPNG, exportSVG, exportGIF, exportMP4, isExporting, exportProgress };
}

// ─── utils ──────────────────────────────────────────────────────────────────

const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
