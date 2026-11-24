import type { LandmarkKey } from '../scene/layout.ts';

export interface WorkInspect {
  image?: string;
  note: string;
  url: string;
  linkLabel: string;
}

export interface WorkEntry {
  id: string;
  title: string;
  reflection: string[];
  inspect: WorkInspect;
}

export interface NodeLink {
  label: string;
  url: string;
}

export interface LandmarkNode {
  landmarkKey: LandmarkKey;
  title: string;
  lines: string[];
  works?: WorkEntry[];
  links?: NodeLink[];
}

export interface NodesDocument {
  schemaVersion: 1;
  audioCredit?: string;
  nodes: LandmarkNode[];
}

const REQUIRED_KEYS: readonly LandmarkKey[] = ['about', 'works', 'interests', 'contact'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldPath} must be a non-empty string`);
  }
  return value;
}

function assertNonEmptyStringArray(value: unknown, fieldPath: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldPath} must be a non-empty string array`);
  }
  return value.map((item, idx) => assertNonEmptyString(item, `${fieldPath}[${idx}]`));
}

function validateOutboundUrl(value: unknown, fieldPath: string): string {
  const raw = assertNonEmptyString(value, fieldPath);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${fieldPath} is not a valid URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
    throw new Error(`${fieldPath} must use https: or mailto: protocol`);
  }
  return raw;
}

function validateInspectImage(value: unknown, fieldPath: string): string {
  const raw = assertNonEmptyString(value, fieldPath);
  if (raw.startsWith('./assets/')) {
    if (raw.includes('..') || raw.includes('\\')) {
      throw new Error(`${fieldPath} cannot contain path traversal`);
    }
    return raw;
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${fieldPath} must be an https: URL or ./assets/... path`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${fieldPath} must use https: protocol or ./assets/... path`);
  }
  return raw;
}

function validateWorkEntry(raw: unknown, fieldPath: string): WorkEntry {
  if (!isRecord(raw)) {
    throw new Error(`${fieldPath} must be an object`);
  }
  const id = assertNonEmptyString(raw.id, `${fieldPath}.id`);
  const title = assertNonEmptyString(raw.title, `${fieldPath}.title`);
  const reflection = assertNonEmptyStringArray(raw.reflection, `${fieldPath}.reflection`);
  if (!isRecord(raw.inspect)) {
    throw new Error(`${fieldPath}.inspect must be an object`);
  }
  const note = assertNonEmptyString(raw.inspect.note, `${fieldPath}.inspect.note`);
  const url = validateOutboundUrl(raw.inspect.url, `${fieldPath}.inspect.url`);
  const linkLabel = assertNonEmptyString(raw.inspect.linkLabel, `${fieldPath}.inspect.linkLabel`);
  const inspect: WorkInspect = { note, url, linkLabel };
  if (raw.inspect.image !== undefined) {
    inspect.image = validateInspectImage(raw.inspect.image, `${fieldPath}.inspect.image`);
  }
  return { id, title, reflection, inspect };
}

function validateLinkEntry(raw: unknown, fieldPath: string): NodeLink {
  if (!isRecord(raw)) {
    throw new Error(`${fieldPath} must be an object`);
  }
  return {
    label: assertNonEmptyString(raw.label, `${fieldPath}.label`),
    url: validateOutboundUrl(raw.url, `${fieldPath}.url`),
  };
}

export function validateNodes(input: unknown): NodesDocument {
  if (!isRecord(input)) {
    throw new Error('nodes document must be an object');
  }
  if (input.schemaVersion !== 1) {
    throw new Error('nodes.schemaVersion must equal 1');
  }
  let audioCredit: string | undefined;
  if (input.audioCredit !== undefined) {
    audioCredit = assertNonEmptyString(input.audioCredit, 'nodes.audioCredit');
  }
  if (!Array.isArray(input.nodes)) {
    throw new Error('nodes.nodes must be an array');
  }

  const seen = new Set<LandmarkKey>();
  const validatedNodes: LandmarkNode[] = input.nodes.map((rawNode, index) => {
    const basePath = `nodes.nodes[${index}]`;
    if (!isRecord(rawNode)) {
      throw new Error(`${basePath} must be an object`);
    }
    const key = rawNode.landmarkKey;
    if (typeof key !== 'string' || !REQUIRED_KEYS.includes(key as LandmarkKey)) {
      throw new Error(`${basePath}.landmarkKey is invalid`);
    }
    const landmarkKey = key as LandmarkKey;
    if (seen.has(landmarkKey)) {
      throw new Error(`Duplicate landmarkKey: ${landmarkKey}`);
    }
    seen.add(landmarkKey);

    const title = assertNonEmptyString(rawNode.title, `${basePath}.title`);
    const lines = assertNonEmptyStringArray(rawNode.lines, `${basePath}.lines`);
    const node: LandmarkNode = { landmarkKey, title, lines };

    if (landmarkKey === 'works') {
      if (!Array.isArray(rawNode.works) || rawNode.works.length < 2 || rawNode.works.length > 3) {
        throw new Error(`${basePath}.works must contain 2 to 3 items`);
      }
      node.works = rawNode.works.map((work, wIdx) =>
        validateWorkEntry(work, `${basePath}.works[${wIdx}]`),
      );
    } else if (rawNode.works !== undefined) {
      throw new Error(`${basePath}.works is only permitted on the works landmark`);
    }

    if (rawNode.links !== undefined) {
      if (!Array.isArray(rawNode.links)) {
        throw new Error(`${basePath}.links must be an array`);
      }
      node.links = rawNode.links.map((link, lIdx) =>
        validateLinkEntry(link, `${basePath}.links[${lIdx}]`),
      );
    }

    return node;
  });

  for (const required of REQUIRED_KEYS) {
    if (!seen.has(required)) {
      throw new Error(`Missing required landmarkKey: ${required}`);
    }
  }

  return audioCredit !== undefined
    ? { schemaVersion: 1, audioCredit, nodes: validatedNodes }
    : { schemaVersion: 1, nodes: validatedNodes };
}
