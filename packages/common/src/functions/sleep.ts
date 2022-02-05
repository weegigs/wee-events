export async function sleep(delay: number) {
  return new Promise((resolve, _reject) => {
    setTimeout(resolve, delay);
  });
}
