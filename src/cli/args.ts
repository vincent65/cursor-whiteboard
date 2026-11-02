export interface CliArgs {
  command: "serve" | "init";
  port: number;
  open: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { command: "serve", port: 4242, open: true };
  let sawCommand = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--no-open") args.open = false;
    else if (arg === "--port") {
      const value = argv[++i];
      const port = Number(value);
      if (!value || !Number.isInteger(port) || port < 0 || port > 65535)
        throw new Error(
          `--port needs a number from 0 to 65535, got ${JSON.stringify(value ?? "")}`,
        );
      args.port = port;
    } else if ((arg === "serve" || arg === "init") && !sawCommand) {
      args.command = arg;
      sawCommand = true;
    } else if (arg.startsWith("-")) throw new Error(`unknown flag: ${arg}`);
    else throw new Error(`unexpected argument: ${arg}`);
  }
  return args;
}
