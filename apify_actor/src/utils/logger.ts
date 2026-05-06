import { log } from "apify";

export const logger = {
  info(message: string, data?: Record<string, unknown>) {
    log.info(message, data);
  },
  warning(message: string, data?: Record<string, unknown>) {
    log.warning(message, data);
  },
  error(message: string, data?: Record<string, unknown>) {
    log.error(message, data);
  }
};
