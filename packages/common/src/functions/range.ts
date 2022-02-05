export const range = function* (total = 0, step = 1, from = 0) {
  // eslint-disable-next-line no-empty
  for (let i = 0; i < total; yield from + i++ * step) {}
};
