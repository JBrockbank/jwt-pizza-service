const request = require('supertest');
const app = require('../service');

const { Role, DB } = require('../database/database.js');

let userToken;
let adminToken;
let testFranchiseId;
let testStoreId;

beforeAll(async () => {
  // Register normal user and get token
  const user = {
    name: 'regular diner',
    email: Math.random().toString(36).substring(2, 12) + '@test.com',
    password: 'password'
  };
  const registerRes = await request(app).post('/api/auth').send(user);
  userToken = registerRes.body.token;

  // Create admin user and get token
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: adminUser.password });
  adminToken = loginRes.body.token;
});

test('GET lists franchises', async () => {
  const res = await request(app).get('/api/franchise?page=0&limit=10&name=').send();
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('franchises');
  expect(Array.isArray(res.body.franchises)).toBe(true);
  expect(typeof res.body.more).toBe('boolean');
});

test('GET returns empty array for unauthorized user', async () => {
  // Random user that is not admin or same userId
  const res = await request(app)
    .get(`/api/franchise/9999999`)
    .set('Authorization', `Bearer ${userToken}`)
    .send();

  expect(res.status).toBe(200);
  expect(res.body).toEqual([]);
});

test('POST rejects franchise creation by non-admin', async () => {
  const franchiseData = { name: 'fail franchise', admins: [{ email: 'foo@bar.com' }] };
  const res = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${userToken}`)
    .send(franchiseData);

  expect(res.status).toBe(403);
});

test('DELETE deletes franchise', async () => {
  const franchiseData = { name: 'franchise to delete', admins: [{ email: await getEmailFromToken(adminToken) }] };
  const creationRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(franchiseData);

  const franchiseIdToDelete = creationRes.body.id;

  // Now delete that franchise
  const res = await request(app)
    .delete(`/api/franchise/${franchiseIdToDelete}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send();

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ message: 'franchise deleted' });
});

test('POST rejects unauthorized user', async () => {
  const storeData = { franchiseId: testFranchiseId, name: 'Not Allowed Store' };
  const res = await request(app)
    .post(`/api/franchise/${testFranchiseId}/store`)
    .set('Authorization', `Bearer ${userToken}`)
    .send(storeData);

  expect(res.status).toBe(403);
});

test('DELETE deletes store as admin', async () => {
  const res = await request(app)
    .delete(`/api/franchise/${testFranchiseId}/store/${testStoreId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send();

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ message: 'store deleted' });
});

test('DELETE rejects unauthorized user', async () => {
  const res = await request(app)
    .delete(`/api/franchise/${testFranchiseId}/store/${testStoreId}`)
    .set('Authorization', `Bearer ${userToken}`)
    .send();

  expect(res.status).toBe(403);
});


function getEmailFromToken(token) {
  const base64Payload = token.split('.')[1];
  const jsonPayload = Buffer.from(base64Payload, 'base64').toString();
  const { email } = JSON.parse(jsonPayload);
  return email;
}

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';
  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

module.exports = {};
