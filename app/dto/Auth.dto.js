'use strict';

const { userDTO } = require('./User.dto');

function sessionDTO(session) {
  if (!session) return null;
  return {
    access_token:  session.access_token,
    refresh_token: session.refresh_token,
    expires_at:    session.expires_at,
    expires_in:    session.expires_in,
  };
}

function signUpDTO(user, session) {
  return {
    user:    userDTO(user),
    session: sessionDTO(session),
  };
}

function signInDTO(user, session) {
  return {
    user:    userDTO(user),
    session: sessionDTO(session),
  };
}

module.exports = { userDTO, sessionDTO, signUpDTO, signInDTO };
