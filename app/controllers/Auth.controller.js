'use strict';

const { anonClient, serviceClient } = require('@database');
const { UserService }               = require('@services');
const { AuthDTO }                   = require('@dto');
const Response                      = require('@helpers/Response.helper');

async function signUp(req, res) {
  const { email, password, display_name } = req.body;

  const { data, error } = await anonClient.auth.signUp({
    email,
    password,
    options: { data: { display_name } },
  });
  if (error) return Response.error(res, error.message, 400);

  // public.users row is created automatically by the DB trigger
  // handle_new_user() in supabase/migrations/001_initial_schema.sql —
  // no manual insert needed here.

  return Response.success(res, AuthDTO.signUpDTO(data.user, data.session), 201);
}

async function signIn(req, res) {
  const { email, password } = req.body;

  const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
  if (error) return Response.error(res, error.message, 401);

  return Response.success(res, AuthDTO.signInDTO(data.user, data.session));
}

async function signOut(req, res) {
  const token = req.headers['authorization'].slice(7);

  const { error } = await serviceClient.auth.admin.signOut(token);
  if (error) return Response.error(res, error.message, 400);

  return Response.success(res, { message: 'Signed out successfully' });
}

async function getMe(req, res) {
  const { data, error } = await UserService.getById(req.user.id);
  if (error) return Response.error(res, error.message, 404);

  return Response.success(res, data);
}

module.exports = { signUp, signIn, signOut, getMe };
