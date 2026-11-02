import { z } from "zod";

export const ExcalidrawElement = z
  .object({
    id: z.string(),
    type: z.string(),
    isDeleted: z.boolean().optional(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    text: z.string().optional(),
    containerId: z.string().nullable().optional(),
    boundElements: z
      .array(z.object({ id: z.string(), type: z.string() }))
      .nullable()
      .optional(),
    startBinding: z
      .object({ elementId: z.string() })
      .loose()
      .nullable()
      .optional(),
    endBinding: z
      .object({ elementId: z.string() })
      .loose()
      .nullable()
      .optional(),
    startArrowhead: z.string().nullable().optional(),
    endArrowhead: z.string().nullable().optional(),
    frameId: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    fileId: z.string().nullable().optional(),
    customData: z.record(z.string(), z.unknown()).optional(),
  })
  .loose();
export type ExcalidrawElement = z.infer<typeof ExcalidrawElement>;

export const BoardFileAsset = z.object({
  id: z.string(),
  mimeType: z.string(),
  created: z.number(),
  asset: z.string(),
});
export type BoardFileAsset = z.infer<typeof BoardFileAsset>;

export const BoardFile = z.object({
  type: z.literal("excalidraw"),
  version: z.number(),
  source: z.string().optional(),
  elements: z.array(ExcalidrawElement),
  appState: z.record(z.string(), z.unknown()).default({}),
  files: z.record(z.string(), BoardFileAsset).default({}),
});
export type BoardFile = z.infer<typeof BoardFile>;

export const BoardNode = z.object({
  id: z.string(),
  kind: z.enum(["box", "ellipse", "diamond", "text", "image", "frame"]),
  label: z.string(),
  frameId: z.string().nullable(),
  asset: z.string().optional(),
  bounds: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
  origin: z.enum(["human", "ai"]),
});
export type BoardNode = z.infer<typeof BoardNode>;

export const BoardEdge = z.object({
  id: z.string(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  label: z.string(),
  arrowheads: z.object({ start: z.boolean(), end: z.boolean() }),
});
export type BoardEdge = z.infer<typeof BoardEdge>;

export const BoardLoose = z.object({
  id: z.string(),
  kind: z.enum(["draw", "line"]),
});
export type BoardLoose = z.infer<typeof BoardLoose>;

export const BoardGraph = z.object({
  board: z.string(),
  nodes: z.array(BoardNode),
  edges: z.array(BoardEdge),
  loose: z.array(BoardLoose),
});
export type BoardGraph = z.infer<typeof BoardGraph>;
