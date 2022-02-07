import { Command } from "commander";

import { DynamoEventStore } from "@weegigs/dynamo-event-store";

export const main = async () => {
  const program = new Command();

  program
    .command("sample <type> <key>")
    .option("--dry-run <dry>", "dry run only, don't perform updates", true)
    .requiredOption("--table <table>", "table to read events from", process.env.EVENTS_TABLE)
    .action(async (type, key, options: { dryRun: string; table: string }) => {
      const store = new DynamoEventStore(options.table, {});

      try {
        const events = await store.load({ type, key });
        console.log(JSON.stringify(events, undefined, 2));
      } catch (error) {
        console.error(error);
      }
    });

  return program.parseAsync();
};
