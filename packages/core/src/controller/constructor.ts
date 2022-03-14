// eslint-disable-next-line @typescript-eslint/ban-types
export type Constructor<T extends Object = Object> = new (...args: any[]) => T;
