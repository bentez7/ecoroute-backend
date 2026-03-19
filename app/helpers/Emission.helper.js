'use strict';

// IPCC emission factors (kg CO2 per kWh of energy consumed)
// LPG/Petrol/Diesel: IPCC AR6 | EV: TNB Malaysia grid intensity 2023
const CO2_FACTORS = {
  lpg:    0.2496,
  diesel: 0.2668,
  petrol: 0.2496,
  ev:     0.585,
  hybrid: 0.2496,
};

/**
 * Calculate CO2 emissions for a given energy consumption and fuel type.
 * @param {number} energyKwh  — energy consumed in kWh
 * @param {string} fuelType   — one of: lpg | diesel | petrol | ev | hybrid
 * @returns {number|null}     — kg of CO2, or null if fuelType is unknown
 */
function calcCO2(energyKwh, fuelType) {
  const factor = CO2_FACTORS[fuelType];
  if (factor === undefined) return null;
  return energyKwh * factor;
}

module.exports = { CO2_FACTORS, calcCO2 };
