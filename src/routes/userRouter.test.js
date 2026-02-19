const request = require("supertest");
const app = require("../service");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test("get logged in user", async () => {
  const res = await request(app)
    .get("/api/user/me")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send();

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    name: testUser.name,
    email: testUser.email,
    roles: [{ role: "diner" }],
  });
  expect(res.body.id).toBeDefined();
});


test('put updates authenticated admin user', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: adminUser.password });
  const adminToken = loginRes.body.token;
  expectValidJwt(adminToken);

  const updates = { name: 'admin updated', email: adminUser.email, password: 'newadminpass' };

  const res = await request(app)
    .put(`/api/user/${adminUser.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send(updates);

  expect(res.status).toBe(200);
  expect(res.body.user).toMatchObject({
    id: adminUser.id,
    name: updates.name,
    email: updates.email,
    roles: [{ role: Role.Admin }]
  });
  expectValidJwt(res.body.token);
});

test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users forbidden for non-admin user', async () => {
  const [, userToken] = await registerUser(request(app));
  const res = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);
  expect(res.status).toBe(403);
  expect(res.body).toHaveProperty('message', 'unauthorized');
});

test('list users allowed for admin user', async () => {
  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: adminUser.password });
  const adminToken = loginRes.body.token;
  expectValidJwt(adminToken);

  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + adminToken);
  expect(listUsersRes.status).toBe(200);
  expect(Array.isArray(listUsersRes.body.users)).toBe(true);
});



async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}



function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

const { Role, DB } = require('../database/database.js');

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}