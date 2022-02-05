import { DEFAULT_SHOULD_RETRY, MAX_LIMIT, retry } from "./retry";

jest.setTimeout(60000);

describe("retry", () => {
  it("should return success if should retry returns false", async () => {
    const result = await retry(
      async () => true,
      () => false
    );

    expect(result).toEqual(true);
  });

  it("should return error if should retry returns false", async () => {
    let failed = false;
    let count = 0;
    try {
      await retry(
        async () => {
          count++;
          return Promise.reject(new Error("rejected"));
        },
        () => false
      );
    } catch (e: any) {
      expect(e.message).toEqual("rejected");
      failed = true;
    }

    expect(failed).toEqual(true);
    expect(count).toEqual(1);
  });

  it("should call should retry for all values", async () => {
    let succeeded = false;
    let failed = false;
    let count = 0;
    try {
      succeeded = await retry(
        async () => (count++ % 2 === 0 ? Promise.resolve(true) : Promise.reject(new Error(`rejected`))),
        () => {
          return true;
        },
        { limit: 5 }
      );
    } catch (e: any) {
      failed = true;
    }

    expect(succeeded).toEqual(true);
    expect(failed).toEqual(false);
    expect(count).toEqual(5);
  });

  it("should allow upto limit retries", async () => {
    let failed = false;
    let count = 0;
    try {
      await retry(
        async () => {
          count++;
          return Promise.reject(new Error(`rejected`));
        },
        () => true,
        { limit: 3 }
      );
    } catch (e: any) {
      failed = true;
    }

    expect(failed).toEqual(true);
    expect(count).toEqual(3);
  });

  it("should have a default limit of 10 attempts", async () => {
    let failed = false;
    let count = 0;
    try {
      await retry(
        async () => {
          count++;
          return Promise.reject(new Error(`rejected`));
        },
        () => true
      );
    } catch (e: any) {
      failed = true;
    }

    expect(failed).toEqual(true);
    expect(count).toEqual(10);
  });

  it("should return the last error generated", async () => {
    let failed = false;
    let count = 0;
    try {
      await retry(
        async () => {
          count++;
          return Promise.reject(new Error(`rejected ${count}`));
        },
        () => true,
        { limit: 2 }
      );
    } catch (e: any) {
      expect(e.message).toEqual("rejected 2");
      failed = true;
    }

    expect(failed).toEqual(true);
    expect(count).toEqual(2);
  });

  it("should recover from failures", async () => {
    let result = false;
    let failed = false;
    let count = 0;
    try {
      result = await retry(
        async () => {
          count++;
          return count > 1 ? Promise.resolve(true) : Promise.reject(new Error(`rejected`));
        },
        (v) => v !== true,
        {
          limit: 31,
        }
      );
    } catch (e: any) {
      failed = true;
    }

    expect(result).toBe(true);
    expect(failed).toEqual(false);
    expect(count).toEqual(2);
  });

  it("should retry on error by default", async () => {
    let result = false;
    let failed = false;
    let count = 0;
    try {
      result = await retry(async () => {
        count++;
        return count > 1 ? Promise.resolve(true) : Promise.reject(new Error(`rejected`));
      });
    } catch (e: any) {
      failed = true;
    }

    expect(result).toBe(true);
    expect(failed).toEqual(false);
    expect(count).toEqual(2);
  });

  it("should fail if limit is greater than max", async () => {
    let result = false;
    let failed = false;
    let count = 0;
    try {
      result = await retry(
        async () => {
          count++;
          return count > 1 ? Promise.resolve(true) : Promise.reject(new Error(`rejected`));
        },
        DEFAULT_SHOULD_RETRY,
        { limit: Number.MAX_SAFE_INTEGER }
      );
    } catch (e: any) {
      expect(e.message).toEqual(`limit must be <= ${MAX_LIMIT}`);
      failed = true;
    }

    expect(result).toBe(false);
    expect(failed).toEqual(true);
    expect(count).toEqual(0);
  });
});
