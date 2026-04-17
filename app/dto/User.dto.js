'use strict';

function userDTO(user) {
  return {
    id:           user.id,
    email:        user.email,
    display_name: user.user_metadata?.display_name ?? null,
    total_co2_kg: user.total_co2_kg ?? 0,
  };
}

module.exports = { userDTO };
