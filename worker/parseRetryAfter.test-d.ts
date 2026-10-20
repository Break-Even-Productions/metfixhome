/**
 * AU26.11 — parseRetryAfter return type is branded 1..600, not plain number.
 * Covered by `npm run check:worker` (included by worker/tsconfig).
 */
import { expectTypeOf } from "vitest";
import { parseRetryAfter, type RetryAfterSeconds } from "./upstream";

expectTypeOf(parseRetryAfter("1")).not.toEqualTypeOf<number>();
expectTypeOf(parseRetryAfter("1")).toEqualTypeOf<RetryAfterSeconds>();

// @ts-expect-error — 0 is outside the branded 1..600 range
const _z: RetryAfterSeconds = 0;
// @ts-expect-error — 601 is outside the branded 1..600 range
const _o: RetryAfterSeconds = 601;
// @ts-expect-error — plain number is not assignable without brand
const _n: RetryAfterSeconds = 17 as number;

void _z;
void _o;
void _n;
