import type { DrawioCommand } from './contracts';

export function isUnnamedDiagram(title: string): boolean {
  return ['', 'untitled', 'new diagram', '未命名'].includes(
    title.trim().toLowerCase()
  );
}

/** File metadata follows successful generation, while user names stay authoritative. */
export function automaticDiagramTitle(
  current: string,
  suggested: string,
  operation: DrawioCommand['operation'],
  userNamed: boolean
): string | null {
  if (userNamed || (operation === 'patch' && !isUnnamedDiagram(current)))
    return null;
  const title = suggested.replace(/\s+/g, ' ').trim().slice(0, 80);
  return title && !isUnnamedDiagram(title) ? title : null;
}
