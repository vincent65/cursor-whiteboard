export const APP_NAME = "Blueprint";

export type IncomingFile = {
  id: string;
  mimeType: string;
  created: number;
  dataURL?: string;
  asset?: string;
};
export type IncomingScene = {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, IncomingFile>;
};
