import { Logger, LoggerInstance, transports } from "winston";

function create(): LoggerInstance {
  return new Logger({
    level: "debug",
    transports: [new transports.Console({ colorize: true, handleExceptions: true })],
  });
}

export const config = {
  logger: create(),
};
