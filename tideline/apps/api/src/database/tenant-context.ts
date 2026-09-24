import { AsyncLocalStorage } from "node:async_hooks";
const storage = new AsyncLocalStorage<string | undefined>();
export function runWithTenant<T>(
  restaurantId: string | undefined,
  work: () => Promise<T>,
): Promise<T> {
  return storage.run(restaurantId, work);
}
export function currentTenant(): string | undefined {
  return storage.getStore();
}
export function enterTenant(restaurantId: string | undefined): void {
  storage.enterWith(restaurantId);
}
