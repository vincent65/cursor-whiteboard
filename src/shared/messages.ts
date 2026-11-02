export type ServerMessage = {
  type: "file-changed";
  kind: "board" | "doc";
  name: string;
};
