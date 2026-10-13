'use client';

import type {
  DrawioBridge,
  NativeEditorView,
} from '@/lib/drawio/editor-bridge';
import { useEffect, useState } from 'react';

export default function NativeStylePanel({
  bridge,
  view,
}: { bridge: DrawioBridge | null; view: NativeEditorView }) {
  const selected = view.selection[0];
  const [label, setLabel] = useState('');
  useEffect(
    () => setLabel(selected?.label || ''),
    [selected?.id, selected?.label]
  );
  const color = (key: string, fallback: string): string =>
    /^#[\da-f]{6}$/i.test(selected?.style[key] || '')
      ? selected!.style[key]
      : fallback;
  if (!selected)
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Select a node or connection to edit its style.
      </p>
    );
  return (
    <div className="space-y-4 p-4 text-sm">
      <label className="block space-y-1">
        <span>Label</span>
        <input
          aria-label="Selected object label"
          disabled={view.selection.length > 1}
          className="w-full rounded-sm border bg-background px-2 py-2"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => {
            if (label !== selected.label)
              bridge?.setSelectedLabel(label, selected.id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </label>
      <label className="block space-y-1">
        <span>Text size</span>
        <select
          aria-label="Text size"
          className="w-full rounded-sm border bg-background px-2 py-2"
          value={selected.style.fontSize || '14'}
          onChange={(event) =>
            bridge?.setSelectedStyle('fontSize', event.target.value)
          }
        >
          {Array.from(
            new Set([
              '10',
              '12',
              '13',
              '14',
              '16',
              '18',
              '20',
              '24',
              '32',
              selected.style.fontSize || '14',
            ])
          ).map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between">
        <span>Text color</span>
        <input
          aria-label="Text color"
          type="color"
          className="h-9 w-14 rounded-sm border bg-background p-1"
          value={color('fontColor', '#000000')}
          onChange={(event) =>
            bridge?.setSelectedStyle('fontColor', event.target.value)
          }
        />
      </label>
      <label className="flex items-center justify-between">
        <span>Fill color</span>
        <input
          aria-label="Fill color"
          type="color"
          className="h-9 w-14 rounded-sm border bg-background p-1"
          value={color('fillColor', '#ffffff')}
          onChange={(event) =>
            bridge?.setSelectedStyle('fillColor', event.target.value)
          }
        />
      </label>
      <label className="flex items-center justify-between">
        <span>Line color</span>
        <input
          aria-label="Line color"
          type="color"
          className="h-9 w-14 rounded-sm border bg-background p-1"
          value={color('strokeColor', '#64748b')}
          onChange={(event) =>
            bridge?.setSelectedStyle('strokeColor', event.target.value)
          }
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Style changes apply to the selected objects and share the canvas undo
        history with AI edits.
      </p>
    </div>
  );
}
