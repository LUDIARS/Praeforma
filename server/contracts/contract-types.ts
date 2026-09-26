/**
 * Local shape of an Augur contract predicate module (Augur live-contract-testing §3.2).
 * Declared here instead of importing `@ludiars/log-weaver` because the runtime is not a
 * dependency of Praeforma; the shape is identical so injection can adopt it later.
 */
export type Verdict = true | false | string;

export interface Contract<A extends unknown[], R> {
  readonly pre?: (...args: A) => Verdict;
  readonly post?: (result: Awaited<R>, ...args: A) => Verdict;
}

/** Contract type of an existing function. */
export type ContractOf<F extends (...args: never[]) => unknown> = Contract<Parameters<F>, ReturnType<F>>;
