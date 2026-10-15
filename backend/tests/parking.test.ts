import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { parkingSlots } from '../src/db/schema';
import { api, bearer, createArea, createUser, resetDb, window } from './helpers';

describe('parking search and slots', () => {
  let fixture: Awaited<ReturnType<typeof createArea>>;
  let admin: Awaited<ReturnType<typeof createUser>>;
  let user: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    await resetDb();
    fixture = await createArea();
    await createArea({ name: 'Lakeside Bike Stand', address: '9 Lake Road', city: 'Secunderabad', latitude: 17.45, longitude: 78.5 });
    admin = await createUser('ADMIN');
    user = await createUser();
  });

  it('TC-05 lists parking areas with availability and price, without logging in', async () => {
    const res = await api().get('/api/parking');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const plaza = res.body.find((a: { name: string }) => a.name === 'Test Plaza Parking');
    expect(plaza).toMatchObject({ totalSlots: 7, availableSlots: 7, pricePerHour: 20, occupancyPercent: 0, isOpenNow: true });
  });

  it('searches by name / location and filters by vehicle type, price and distance', async () => {
    expect((await api().get('/api/parking?q=lakeside')).body).toHaveLength(1);
    expect((await api().get('/api/parking?q=secunderabad')).body[0].name).toBe('Lakeside Bike Stand');
    expect((await api().get('/api/parking?q=nowhere')).body).toHaveLength(0);

    const cars = await api().get('/api/parking?vehicleType=CAR');
    expect(cars.body[0]).toMatchObject({ totalSlots: 4, pricePerHour: 40 });
    expect((await api().get('/api/parking?vehicleType=CAR&maxPrice=30')).body).toHaveLength(0);

    const near = await api().get('/api/parking?sort=distance&lat=17.45&lng=78.5');
    expect(near.body[0].name).toBe('Lakeside Bike Stand');
    expect(near.body[0].distanceKm).toBe(0);
    expect(near.body[1].distanceKm).toBeGreaterThan(5);
  });

  it('TC-06 shows each slot with status, type and effective price', async () => {
    const res = await api().get(`/api/parking/${fixture.area.id}/slots`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
    expect(res.body.find((s: { slotNumber: string }) => s.slotNumber === 'A-101')).toMatchObject({ status: 'AVAILABLE', vehicleType: 'CAR', price: 40, bookable: true });
    expect((await api().get(`/api/parking/${fixture.area.id}/slots?vehicleType=BIKE`)).body).toHaveLength(2);
  });

  it('returns 404 for an unknown area and 400 for a malformed id', async () => {
    expect((await api().get('/api/parking/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await api().get('/api/parking/not-a-uuid')).status).toBe(400);
  });

  it('TC-14 blocks customers and anonymous visitors from admin operations', async () => {
    const body = { name: 'Hacker Lot', address: '1 Nowhere Lane', city: 'X-City', latitude: 1, longitude: 1 };
    expect((await api().post('/api/parking').send(body)).status).toBe(401);
    expect((await api().post('/api/parking').set(bearer(user.token)).send(body)).status).toBe(403);
    expect((await api().get('/api/admin/dashboard').set(bearer(user.token))).status).toBe(403);
    expect((await api().get('/api/admin/users')).status).toBe(401);
    expect((await api().patch(`/api/slots/${fixture.car[0].id}/status`).set(bearer(user.token)).send({ status: 'OCCUPIED' })).status).toBe(403);
  });

  it('lets an admin create, edit and deactivate a parking area with rates and hours', async () => {
    const created = await api()
      .post('/api/parking')
      .set(bearer(admin.token))
      .send({ name: 'Airport Long Stay', address: 'Terminal Road, Shamshabad', city: 'Hyderabad', latitude: 17.24, longitude: 78.43 });
    expect(created.status).toBe(201);
    expect(created.body.rates).toHaveLength(3);
    expect(created.body.operatingHours).toHaveLength(7);

    const id = created.body.id;
    const rates = await api().put(`/api/parking/${id}/rates`).set(bearer(admin.token)).send({ rates: [{ vehicleType: 'CAR', hourlyRate: 75 }] });
    expect(rates.body.rates).toEqual([{ vehicleType: 'CAR', hourlyRate: 75 }]);

    const hours = created.body.operatingHours.map((h: object) => ({ ...h, openTime: '09:00', closeTime: '18:00' }));
    const updatedHours = await api().put(`/api/parking/${id}/hours`).set(bearer(admin.token)).send({ operatingHours: hours });
    expect(updatedHours.body.operatingHours[0]).toMatchObject({ openTime: '09:00', closeTime: '18:00' });

    const slot = await api().post(`/api/parking/${id}/slots`).set(bearer(admin.token)).send({ slotNumber: 'a-101', vehicleType: 'CAR' });
    expect(slot.status).toBe(201);
    expect(slot.body).toMatchObject({ slotNumber: 'A-101', price: 75 });
    expect((await api().post(`/api/parking/${id}/slots`).set(bearer(admin.token)).send({ slotNumber: 'A-101', vehicleType: 'CAR' })).status).toBe(409);

    const edited = await api().put(`/api/slots/${slot.body.id}`).set(bearer(admin.token)).send({ price: 90, floor: '3' });
    expect(edited.body).toMatchObject({ price: 90, floor: '3' });

    const removed = await api().delete(`/api/parking/${id}`).set(bearer(admin.token));
    expect(removed.body.status).toBe('INACTIVE');
    expect((await api().get(`/api/parking/${id}`)).status).toBe(404); // hidden from customers
    expect((await api().get(`/api/parking/${id}`).set(bearer(admin.token))).status).toBe(200); // still visible to admin
    expect((await api().get('/api/parking')).body.map((a: { id: string }) => a.id)).not.toContain(id);
  });

  it('TC-13 admin slot status changes update availability and occupancy', async () => {
    const [a, b, c] = fixture.car;
    await api().patch(`/api/slots/${a.id}/status`).set(bearer(admin.token)).send({ status: 'OCCUPIED' }).expect(200);
    await api().patch(`/api/slots/${b.id}/status`).set(bearer(admin.token)).send({ status: 'MAINTENANCE' }).expect(200);
    expect((await api().patch(`/api/slots/${c.id}/status`).set(bearer(admin.token)).send({ status: 'RESERVED' })).status).toBe(400);

    const area = await api().get(`/api/parking/${fixture.area.id}`);
    expect(area.body.counts).toEqual({ AVAILABLE: 5, RESERVED: 0, OCCUPIED: 1, MAINTENANCE: 1 });
    expect(area.body.occupancyPercent).toBe(14.3);

    const occupancy = await api().get('/api/admin/occupancy').set(bearer(admin.token));
    expect(occupancy.body.areas.find((x: { id: string }) => x.id === fixture.area.id)).toMatchObject({ total: 7, available: 5, occupied: 1, maintenance: 1 });

    const slots = await api().get(`/api/parking/${fixture.area.id}/slots?start=${window(1).startTime}&end=${window(1).endTime}`);
    const byNumber = Object.fromEntries(slots.body.map((s: { slotNumber: string }) => [s.slotNumber, s]));
    expect(byNumber['A-102']).toMatchObject({ bookable: false, unavailableReason: 'Under maintenance' });
    expect(byNumber['A-103'].bookable).toBe(true);

    await db.update(parkingSlots).set({ status: 'AVAILABLE' }).where(eq(parkingSlots.parkingAreaId, fixture.area.id));
  });
});
