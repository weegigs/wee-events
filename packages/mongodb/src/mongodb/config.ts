import { Logger, LoggerInstance, transports } from "winston";

function create(): LoggerInstance {
  return new Logger({
    level: "info",
    transports: [new transports.Console({ colorize: true, handleExceptions: true })],
  });
}

export const config = {
  logger: create(),
};
