// This app is single-user for now — every row is scoped to this fixed id
// instead of a real signed-in user. seed.sql inserts a matching row into
// `users`. Swap this out once real auth is added.
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
