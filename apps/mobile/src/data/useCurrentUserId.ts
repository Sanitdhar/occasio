import { userId, type UserId } from '@occasio/core';

/**
 * Who is using the app.
 *
 * A constant until sign-in lands (epic #5). It is a hook rather than an exported constant so
 * that the day it becomes real, every caller already reads it from the right shape — a
 * component that imported a constant would have to be rewritten to read a session, and the ones
 * that forgot would keep compiling.
 *
 * It names the wedding's organiser because that is the account with something to look at in
 * every screen the app has so far, and it is deliberately not configurable: the moment a
 * placeholder identity becomes a setting it starts to look like authentication.
 */
const DEMO_USER = userId('u_sanit');

export const useCurrentUserId = (): UserId => DEMO_USER;
