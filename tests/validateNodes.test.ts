import { describe, expect, it } from 'vitest';
import rawNodes from '../src/content/nodes.json' with { type: 'json' };
import { validateNodes } from '../src/content/validateNodes.ts';

function cloneSample(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(rawNodes)) as Record<string, unknown>;
}

describe('validateNodes schema validator', () => {
  it('accepts valid 4-node nodes.json document', () => {
    const doc = validateNodes(rawNodes);
    expect(doc.schemaVersion).toBe(1);
    expect(doc.nodes).toHaveLength(4);
  });

  it('throws on missing or duplicate landmarkKey entries', () => {
    const missing = cloneSample();
    missing.nodes = (missing.nodes as Array<{ landmarkKey: string }>).slice(0, 3);
    expect(() => validateNodes(missing)).toThrow(/Missing required landmarkKey/);

    const duplicate = cloneSample();
    const list = duplicate.nodes as Array<{ landmarkKey: string }>;
    const first = list[0];
    if (!first) {
      throw new Error('Expected seed node 0');
    }
    list[1] = { ...first };
    expect(() => validateNodes(duplicate)).toThrow(/Duplicate landmarkKey/);
  });

  it('throws on empty lines, empty reflection, and works count outside 2..3', () => {
    const emptyLines = cloneSample();
    ((emptyLines.nodes as Array<{ lines: string[] }>)[0] as { lines: string[] }).lines = [];
    expect(() => validateNodes(emptyLines)).toThrow(/lines must be a non-empty string array/);

    const tooFewWorks = cloneSample();
    const worksNode = (tooFewWorks.nodes as Array<{ landmarkKey: string; works?: unknown[] }>).find(
      (n) => n.landmarkKey === 'works',
    );
    if (worksNode?.works) {
      worksNode.works = worksNode.works.slice(0, 1);
    }
    expect(() => validateNodes(tooFewWorks)).toThrow(/works must contain 2 to 3 items/);
  });

  it('rejects unsafe outbound link URLs and validates inspect.image paths', () => {
    const badJsUrl = cloneSample();
    const contactNode = (
      badJsUrl.nodes as Array<{ landmarkKey: string; links?: Array<{ url: string }> }>
    ).find((n) => n.landmarkKey === 'contact');
    if (contactNode?.links?.[0]) {
      contactNode.links[0].url = 'javascript:alert(1)';
    }
    expect(() => validateNodes(badJsUrl)).toThrow(/https: or mailto:/);

    const badHttpUrl = cloneSample();
    const cNode = (
      badHttpUrl.nodes as Array<{ landmarkKey: string; links?: Array<{ url: string }> }>
    ).find((n) => n.landmarkKey === 'contact');
    if (cNode?.links?.[0]) {
      cNode.links[0].url = 'http://insecure.example.com';
    }
    expect(() => validateNodes(badHttpUrl)).toThrow(/https: or mailto:/);

    const validLocalImg = cloneSample();
    const wNodeValid = (
      validLocalImg.nodes as Array<{
        landmarkKey: string;
        works?: Array<{ inspect: { image?: string } }>;
      }>
    ).find((n) => n.landmarkKey === 'works');
    if (wNodeValid?.works?.[0]) {
      wNodeValid.works[0].inspect.image = './assets/works/one.webp';
    }
    expect(() => validateNodes(validLocalImg)).not.toThrow();

    const traversalImg = cloneSample();
    const wNodeTraversal = (
      traversalImg.nodes as Array<{
        landmarkKey: string;
        works?: Array<{ inspect: { image?: string } }>;
      }>
    ).find((n) => n.landmarkKey === 'works');
    if (wNodeTraversal?.works?.[0]) {
      wNodeTraversal.works[0].inspect.image = './assets/../secret.png';
    }
    expect(() => validateNodes(traversalImg)).toThrow(/path traversal/);

    const dataImg = cloneSample();
    const wNodeData = (
      dataImg.nodes as Array<{
        landmarkKey: string;
        works?: Array<{ inspect: { image?: string } }>;
      }>
    ).find((n) => n.landmarkKey === 'works');
    if (wNodeData?.works?.[0]) {
      wNodeData.works[0].inspect.image = 'data:image/png;base64,AAAA';
    }
    expect(() => validateNodes(dataImg)).toThrow(/https: protocol or \.\/assets/);
  });
});
