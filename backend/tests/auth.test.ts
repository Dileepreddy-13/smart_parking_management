import jwt from 'jsonwebtoken';
import { beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, createUser, resetDb } from './helpers';

const newUser = { name: 'Asha Kumar', email: 'asha@test.local', password: 'Passw0rd!', phone: '+91 98765 43210' };

describe('authentication', () => {
  beforeAll(resetDb);

  it('TC-01 registers a valid user and never returns the password', async () => {
    const res = await api().post('/api/auth/register').send(newUser);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ email: newUser.email, role: 'USER', status: 'ACTIVE' });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('TC-02 rejects a duplicate email', async () => {
    const res = await api().post('/api/auth/register').send({ ...newUser, email: 'ASHA@test.local' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects invalid registration input with field details', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'x', email: 'nope', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('TC-03 logs in with valid credentials and returns the profile', async () => {
    const login = await api().post('/api/auth/login').send({ email: newUser.email, password: newUser.password });
    expect(login.status).toBe(200);
    const me = await api().get('/api/auth/me').set(bearer(login.body.token));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(newUser.email);
    expect(me.body.user.passwordHash).toBeUndefined();
  });

  it('TC-04 rejects a wrong password and an unknown email with the same message', async () => {
    const wrong = await api().post('/api/auth/login').send({ email: newUser.email, password: 'Wrong1234' });
    const unknown = await api().post('/api/auth/login').send({ email: 'ghost@test.local', password: 'Wrong1234' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('rejects requests without a token, with a bad token and with an expired token', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set(bearer('garbage'))).body.error.code).toBe('TOKEN_INVALID');
    const user = await createUser();
    const expired = jwt.sign({ sub: user.id, role: 'USER' }, process.env.JWT_SECRET!, { expiresIn: -10 });
    const res = await api().get('/api/auth/me').set(bearer(expired));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('updates the profile and changes the password', async () => {
    const user = await createUser();
    const profile = await api().put('/api/auth/profile').set(bearer(user.token)).send({ name: 'Renamed User', phone: '9000000000' });
    expect(profile.body.user).toMatchObject({ name: 'Renamed User', phone: '9000000000' });

    const bad = await api().put('/api/auth/password').set(bearer(user.token)).send({ currentPassword: 'nope', newPassword: 'NewPassw0rd' });
    expect(bad.status).toBe(400);
    const ok = await api().put('/api/auth/password').set(bearer(user.token)).send({ currentPassword: user.password, newPassword: 'NewPassw0rd' });
    expect(ok.status).toBe(200);
    expect((await api().post('/api/auth/login').send({ email: user.email, password: 'NewPassw0rd' })).status).toBe(200);
  });

  it('manages vehicles', async () => {
    const user = await createUser();
    const added = await api().post('/api/vehicles').set(bearer(user.token)).send({ vehicleNumber: 'ts09 ab 1234', vehicleType: 'CAR' });
    expect(added.status).toBe(201);
    expect(added.body.vehicleNumber).toBe('TS09AB1234');
    expect((await api().post('/api/vehicles').set(bearer(user.token)).send({ vehicleNumber: 'TS09AB1234', vehicleType: 'CAR' })).status).toBe(409);
    expect((await api().get('/api/vehicles').set(bearer(user.token))).body).toHaveLength(1);
    expect((await api().delete(`/api/vehicles/${added.body.id}`).set(bearer(user.token))).status).toBe(204);
  });
});
