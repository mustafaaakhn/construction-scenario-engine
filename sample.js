const sampleProject = {
  name: 'Example housing project',
  contractValue: 6_000_000,
  initialCash: 250_000,
  monthlyOverhead: 50_000,
  monthlyRate: 2,
  paymentDelay: 1,
  months: [
    { claim: 1_000_000, steel: 500_000, concrete: 200_000, labor: 200_000, other: 50_000 },
    { claim: 1_000_000, steel: 400_000, concrete: 200_000, labor: 200_000, other: 50_000 },
    { claim: 1_000_000, steel: 300_000, concrete: 100_000, labor: 200_000, other: 50_000 },
    { claim: 1_000_000, steel: 200_000, concrete: 100_000, labor: 200_000, other: 50_000 },
    { claim: 1_000_000, steel: 100_000, concrete: 50_000, labor: 200_000, other: 50_000 },
    { claim: 1_000_000, steel: 0, concrete: 0, labor: 200_000, other: 50_000 },
  ],
};
