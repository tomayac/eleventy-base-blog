export class AbortError extends Error {
  constructor(message) {
    super(message);
    this.name = "AbortError";
  }
}

const pRetry = async (fn) => {
  try {
    return await fn(1);
  } catch (err) {
    throw err;
  }
};
export default pRetry;
