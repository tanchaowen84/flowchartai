import { describe, expect, it } from 'vitest';
import { getHeroSubmitLabel } from './hero-controls';

describe('getHeroSubmitLabel', () => {
  it('names the text submit action', () => {
    expect(getHeroSubmitLabel('text_to_flowchart', false)).toBe(
      'Create flowchart from text'
    );
  });

  it('names the image submit action', () => {
    expect(getHeroSubmitLabel('image_to_flowchart', false)).toBe(
      'Create flowchart from image'
    );
  });

  it('announces the busy action', () => {
    expect(getHeroSubmitLabel('text_to_flowchart', true)).toBe(
      'Creating flowchart'
    );
  });
});
