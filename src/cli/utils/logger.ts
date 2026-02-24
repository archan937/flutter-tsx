import { createConsola } from "consola";

export const logger = createConsola({
  level: 4, // info
  formatOptions: {
    colors: true,
    compact: false,
  },
});

export { logger as log };
