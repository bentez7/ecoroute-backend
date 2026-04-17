'use strict';

const { serviceClient, models } = require('@database');
const { UserModel } = models;

const { TABLE, FIELDS } = UserModel;

async function getById(userId) {
  return serviceClient
    .from(TABLE)
    .select('*')
    .eq(FIELDS.ID, userId)
    .single();
}

async function updateProfile(userId, updates) {
  const allowed = {};
  if (updates.display_name !== undefined) allowed[FIELDS.DISPLAY_NAME] = updates.display_name;
  if (updates.avatar_url   !== undefined) allowed[FIELDS.AVATAR_URL]   = updates.avatar_url;

  return serviceClient
    .from(TABLE)
    .update(allowed)
    .eq(FIELDS.ID, userId)
    .select()
    .single();
}

async function incrementCO2(userId, amountKg) {
  return serviceClient.rpc('increment_user_co2', {
    p_user_id: userId,
    p_amount:  amountKg,
  });
}

async function softDelete(userId) {
  return serviceClient
    .from(TABLE)
    .update({ [FIELDS.ACCOUNT_STATUS]: UserModel.ACCOUNT_STATUSES.DELETED })
    .eq(FIELDS.ID, userId)
    .select()
    .single();
}

module.exports = { getById, updateProfile, softDelete, incrementCO2 };
