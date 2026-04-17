export interface PredicateAlgebra<P> {
  empty(): P;
  union(a: P, b: P): P;
  intersect(a: P, b: P): P;
  /**
   * Set-theoretic difference a \ b.
   * The return type stays inside the predicate domain so callers do not need
   * to assume predicates are single intervals or single atoms.
   */
  difference(a: P, b: P): P;
  isEmpty(predicate: P): boolean;
  isSatisfiable(predicate: P): boolean;
  equals(a: P, b: P): boolean;
}

