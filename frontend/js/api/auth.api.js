/* Sign-in and the administrator's "view as" switch.  Backend: routes/auth.routes.js */
import { get, post } from './client.js';

/* The signed-in user, or null when nobody is signed in. Does not trigger the login screen. */
export async function getMe() {
  try { return await get('/me', { allow401: true }); } catch (e) { return null; }
}

/* { user } on success. A wrong password is an ApiError with code 'bad_credentials' (401),
   too many failed attempts is 'too_many_attempts' (429). */
export const login = (email, password) => post('/login', { email, password }, { allow401: true });
export const logout = () => post('/logout');

/* administrator only */
export const listSwitchUsers = () => get('/switch/users');
export const switchToUser = (userId) => post('/switch', { user_id: userId });
export const stopSwitch = () => post('/switch/stop');
