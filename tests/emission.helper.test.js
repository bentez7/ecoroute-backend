'use strict';

const { calcCO2, CO2_FACTORS } = require('../app/helpers/Emission.helper');

describe('Emission Helper — calcCO2', () => {
  it('calculates CO2 for petrol', () => {
    expect(calcCO2(10, 'petrol')).toBeCloseTo(2.496);
  });

  it('calculates CO2 for diesel', () => {
    expect(calcCO2(10, 'diesel')).toBeCloseTo(2.668);
  });

  it('calculates CO2 for LPG', () => {
    expect(calcCO2(10, 'lpg')).toBeCloseTo(2.496);
  });

  it('calculates CO2 for EV (Malaysia grid)', () => {
    expect(calcCO2(10, 'ev')).toBeCloseTo(5.85);
  });

  it('calculates CO2 for hybrid', () => {
    expect(calcCO2(10, 'hybrid')).toBeCloseTo(2.496);
  });

  it('returns null for unknown fuel type', () => {
    expect(calcCO2(10, 'hydrogen')).toBeNull();
  });

  it('returns 0 for zero energy', () => {
    expect(calcCO2(0, 'petrol')).toBe(0);
  });

  it('has all expected fuel types', () => {
    expect(Object.keys(CO2_FACTORS).sort()).toEqual(['diesel', 'ev', 'hybrid', 'lpg', 'petrol']);
  });
});
