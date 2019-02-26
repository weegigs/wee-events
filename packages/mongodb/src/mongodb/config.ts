import { Logger, createLogger, transports } from "winston";

function create(): Logger {
  return createLogger({
    level: "info",
    transports: [new transports.Console({ handleExceptions: true })],
  });
}

export const config = {
  logger: create(),
};
