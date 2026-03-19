'use strict';

const { serviceClient, models } = require('@database');
const { VehicleModel } = models;

const { TABLE, FIELDS } = VehicleModel;

async function create(userId, vehicleData) {
  return serviceClient
    .from(TABLE)
    .insert({ ...vehicleData, [FIELDS.USER_ID]: userId })
    .select()
    .single();
}

async function getByUserId(userId) {
  return serviceClient
    .from(TABLE)
    .select('*')
    .eq(FIELDS.USER_ID, userId)
    .order(FIELDS.CREATED_AT, { ascending: false });
}

async function getById(vehicleId, userId) {
  return serviceClient
    .from(TABLE)
    .select('*')
    .eq(FIELDS.ID, vehicleId)
    .eq(FIELDS.USER_ID, userId)
    .single();
}

async function update(vehicleId, userId, updates) {
  const allowed = {};
  const editable = [
    FIELDS.MAKE, FIELDS.MODEL, FIELDS.YEAR,
    FIELDS.VEHICLE_TYPE, FIELDS.VEHICLE_MASS_KG,
    FIELDS.DRAG_COEFFICIENT, FIELDS.DRIVETRAIN_TYPE, FIELDS.IS_DEFAULT,
  ];
  for (const field of editable) {
    if (updates[field] !== undefined) allowed[field] = updates[field];
  }

  return serviceClient
    .from(TABLE)
    .update(allowed)
    .eq(FIELDS.ID, vehicleId)
    .eq(FIELDS.USER_ID, userId)
    .select()
    .single();
}

async function remove(vehicleId, userId) {
  return serviceClient
    .from(TABLE)
    .delete()
    .eq(FIELDS.ID, vehicleId)
    .eq(FIELDS.USER_ID, userId);
}

// Sets one vehicle as default, clears is_default on all others for that user
async function setDefault(vehicleId, userId) {
  await serviceClient
    .from(TABLE)
    .update({ [FIELDS.IS_DEFAULT]: false })
    .eq(FIELDS.USER_ID, userId);

  return serviceClient
    .from(TABLE)
    .update({ [FIELDS.IS_DEFAULT]: true })
    .eq(FIELDS.ID, vehicleId)
    .eq(FIELDS.USER_ID, userId)
    .select()
    .single();
}

module.exports = { create, getByUserId, getById, update, remove, setDefault };
