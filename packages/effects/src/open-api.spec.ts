import * as api from "./open-api";
import * as receipts from "./service/sample/receipts";

describe("describe service specification", () => {
  it("should describe valid service specification", () => {
    const result = api.spec(receipts.description);
    expect(result).toMatchSnapshot();
  });
});
