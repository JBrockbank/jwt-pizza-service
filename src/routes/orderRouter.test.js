const request = require('supertest');
const app = require('../service');

let userToken;
let adminToken;

beforeAll(async () => {
  const user = { name: 'regular diner', email: Math.random().toString(36).substring(2, 12) + '@test.com', password: 'password' };
  const registerRes = await request(app).post('/api/auth').send(user);
  userToken = registerRes.body.token;

  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: adminUser.password });
  adminToken = loginRes.body.token;
});

test('GET pizza menu', async () => {
  const res = await request(app).get('/api/order/menu').send();
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('PUT menu denies access to non-admin users', async () => {
  const newItem = { title: 'Student', description: 'No topping, just carbs', image: 'pizza9.png', price: 0.0001 };
  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${userToken}`)
    .send(newItem);
  expect(res.status).toBe(403);
});

test('PUT allows admin to add item', async () => {
  const newItem = { title: 'Student', description: 'No topping, just carbs', image: 'pizza9.png', price: 0.0001 };
  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(newItem);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.some(item => item.title === newItem.title)).toBe(true);
});

test('GET order returns orders for authenticated user', async () => {
  const res = await request(app)
    .get('/api/order')
    .set('Authorization', `Bearer ${userToken}`)
    .send();
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('dinerId');
  expect(Array.isArray(res.body.orders)).toBe(true);
});

test('POST creates new order for authenticated user', async () => {
  const orderPayload = {
    franchiseId: 1,
    storeId: 1,
    items: [{ menuId: 1, description: 'Veggie', price: 0.05 }]
  };

  const res = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${userToken}`)
    .send(orderPayload);

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('order');
  expect(res.body).toHaveProperty('jwt');
  expect(res.body.order).toMatchObject({
    franchiseId: orderPayload.franchiseId,
    storeId: orderPayload.storeId,
  });
  expect(Array.isArray(res.body.order.items)).toBe(true);
  expect(res.body.order.items[0]).toMatchObject(orderPayload.items[0]);
});


const { Role, DB } = require('../database/database.js');

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
