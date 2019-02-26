import { createLogger, Logger, transports } from "winston";

function create(): Logger {
  return createLogger({
    level: "debug",
    transports: [new transports.Console({ handleExceptions: true })],
  });
}

export const config = {
  logger: create(),
};
