'use strict';

function userDTO(user) {
  return {
    id:           user.id,
    email:        user.email,
    display_name: user.user_metadata?.display_name ?? null,
  };
}

module.exports = { userDTO };
