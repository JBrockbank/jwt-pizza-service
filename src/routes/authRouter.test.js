const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});



test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test('logout', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const token = loginRes.body.token;
  expectValidJwt(token);

  const logoutRes = await request(app)
    .delete('/api/auth')
    .set('Authorization', `Bearer ${token}`)
    .send();

  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body).toMatchObject({ message: 'logout successful' });
});

test('failed registration with missing fields', async () => {
  const missingName = { email: 'missing@field.com', password: '123' };
  let res = await request(app).post('/api/auth').send(missingName);
  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/name, email, and password are required/i);

  const missingEmail = { name: 'Test', password: '123' };
  res = await request(app).post('/api/auth').send(missingEmail);
  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/name, email, and password are required/i);

  const missingPassword = { name: 'Test', email: 'missing@field.com' };
  res = await request(app).post('/api/auth').send(missingPassword);
  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/name, email, and password are required/i);
});



function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}