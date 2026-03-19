'use strict';

const axios                  = require('axios');
const { XMLParser }          = require('fast-xml-parser');
const { VEHICLE_API_USERNAME } = require('@config');
const { VEHICLE_TYPES }      = require('@database').models.VehicleModel;
const Logger                 = require('@utils/Logger.util');

const API_URL  = 'https://www.vehicleapi.com.my/api/reg.asmx/CheckMalaysia';
const USERNAME = VEHICLE_API_USERNAME || '';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
});

/**
 * Map the registry's FuelType string to our VEHICLE_TYPES enum.
 */
const FUEL_TYPE_MAP = {
  'petrol':   VEHICLE_TYPES.PETROL,
  'diesel':   VEHICLE_TYPES.DIESEL,
  'lpg':      VEHICLE_TYPES.LPG,
  'electric': VEHICLE_TYPES.EV,
  'hybrid':   VEHICLE_TYPES.HYBRID,
};

function mapFuelType(raw) {
  if (!raw) return null;
  const key = String(raw).toLowerCase().trim();
  return FUEL_TYPE_MAP[key] || null;
}

function extractText(field) {
  if (!field) return null;
  if (typeof field === 'string') return field;
  return field.CurrentTextValue || field.CurrentValue || null;
}

/**
 * Lookup vehicle details by Malaysian registration number.
 * @param {string} registrationNumber — e.g. "ABC1234"
 * @returns {Promise<Object>} normalized vehicle data
 */
async function lookupByPlate(registrationNumber) {
  if (!USERNAME) {
    throw new Error('VEHICLE_API_USERNAME is not configured — set it in .env');
  }

  let xmlResponse;
  try {
    const { data } = await axios.post(
      API_URL,
      `RegistrationNumber=${encodeURIComponent(registrationNumber)}&username=${encodeURIComponent(USERNAME)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 },
    );
    xmlResponse = data;
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data || err.message;
    Logger.error('Vehicle registry API error:', { status, detail });
    throw new Error(`Vehicle registry API returned ${status || 'no response'}: ${typeof detail === 'string' ? detail.substring(0, 200) : err.message}`);
  }

  const parsed = parser.parse(xmlResponse);
  const vehicleData = parsed?.Vehicle?.vehicleData;

  if (!vehicleData) {
    throw new Error('Vehicle not found for the given registration number');
  }

  Logger.debug('Vehicle registry response:', vehicleData);

  return {
    make:         extractText(vehicleData.CarMake) || vehicleData.MakeDescription || null,
    model:        extractText(vehicleData.CarModel) || vehicleData.ModelDescription || null,
    year:         vehicleData.RegistrationYear ? parseInt(vehicleData.RegistrationYear, 10) : null,
    fuel_type:    mapFuelType(extractText(vehicleData.FuelType)),
    engine_size:  extractText(vehicleData.EngineSize),
    transmission: extractText(vehicleData.Transmission),
    body_style:   extractText(vehicleData.BodyStyle),
  };
}

module.exports = { lookupByPlate };
