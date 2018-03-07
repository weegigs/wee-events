import { PublishedEvent, SourceEvent, combineReducers, Reducer } from "../src";

class Increment implements SourceEvent<"increment"> {
  type: "increment";
  aggregateId = { id: "1", type: "test" };
}

const increment: (count: number) => PublishedEvent[] = (count: number) => {
  const result: PublishedEvent[] = [];

  for (let i = 0; i < count; i++) {
    result.push(new Increment());
  }

  return result;
};

const add: Reducer<string, Increment> = (state: string, event: Increment) => {
  return `${state}${state.length > 0 ? "+" : ""}${state.length}`;
};

const deduct: Reducer<string, Increment> = (state: string, event: Increment) => {
  return `${state}-${state.length}`;
};

const willError: Reducer<string, Increment> = (state: string, event: Increment) => {
  throw new Error("Boom");
};

function delayed<S, E extends SourceEvent>(reducer: Reducer<S, E>): Reducer<S, E> {
  return async (state: S, event: PublishedEvent<E>) => {
    return new Promise<S>(resolve => {
      setTimeout(function() {
        resolve(reducer(state, event));
      }, Math.random() * 500);
    });
  };
}

describe("combining reducers", () => {
  it("processes simple reducers in order", async () => {
    const events = increment(1);

    const reducers = combineReducers({
      add,
      deduct,
    });

    const result = await reducers("", events[0]);

    expect(result).toBeDefined();
    expect(result).toEqual("0-1");
  });

  it("processes simple promise reducers in order", async () => {
    const events = increment(1);

    const reducers = combineReducers({
      add,
      delayed: delayed(add),
      deduct,
    });

    const result = await reducers("", events[0]);

    expect(result).toBeDefined();
    expect(result).toEqual("0+1-3");
  });

  it("captures errors", async () => {
    const events = increment(1);

    debugger;
    const reducers = combineReducers({
      add: delayed(add),
      deduct,
      willError,
    });

    try {
      await reducers("", events[0]);
      fail("Expected reducer to fail");
    } catch (error) {
      debugger;
      expect(error).toBeDefined();
      expect(error.message).toEqual("[ReducerError] willError Boom");
    }
  });
});
