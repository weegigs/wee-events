import zlib from "zlib";
import { promisify } from "util";

const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

const _enc: Record<string, string> = { "+": "-", "/": "_", "=": "" };

export const DeflateEncoder = {
  encode: async (source: Buffer): Promise<string> => {
    const compressed = await deflate(source);
    return compressed.toString("base64").replace(/[+/=]/g, (match) => _enc[match]);
  },

  decode: async (source: string): Promise<Buffer> => {
    return await inflate(Buffer.from(source, "base64"));
  },
};
