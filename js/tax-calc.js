/**
 * Progressive-bracket tax calculation.
 *
 * brackets: [{ upTo: number|null, rate: number }, ...] in ascending order,
 * where `upTo` is the top of that bracket (null = unbounded, i.e. the top
 * bracket) and `rate` is a fraction (0.22 = 22%).
 */
function calculateTax(brackets, income) {
  if (!brackets || !brackets.length || !income || income <= 0) return 0;

  let tax = 0;
  let lowerBound = 0;

  for (const bracket of brackets) {
    const upperBound = bracket.upTo === null || bracket.upTo === undefined
      ? Infinity
      : bracket.upTo;

    if (income <= lowerBound) break;

    const taxableAtThisRate = Math.min(income, upperBound) - lowerBound;
    if (taxableAtThisRate > 0) {
      tax += taxableAtThisRate * bracket.rate;
    }
    lowerBound = upperBound;
    if (income <= upperBound) break;
  }

  return tax;
}

/** Effective (average) tax rate as a fraction of gross income. */
function effectiveRate(brackets, income) {
  if (!income || income <= 0) return 0;
  return calculateTax(brackets, income) / income;
}

/** The marginal bracket rate that applies to the next dollar earned. */
function marginalRate(brackets, income) {
  if (!brackets || !brackets.length) return 0;
  for (const bracket of brackets) {
    const upperBound = bracket.upTo === null || bracket.upTo === undefined
      ? Infinity
      : bracket.upTo;
    if (income <= upperBound) return bracket.rate;
  }
  return brackets[brackets.length - 1].rate;
}
