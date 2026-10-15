import { expect, test, type Page } from '@playwright/test';

const unique = Date.now().toString(36);
const customer = { name: 'Priya Sharma', email: `priya.${unique}@e2e.local`, password: 'Passw0rd!' };
const ADMIN = { email: 'admin@smartparking.local', password: 'Admin@123' };

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test.describe.configure({ mode: 'serial' });

test('customer: register → search → select slot → reserve → pay → notification → booking', async ({ page }) => {
  // Register
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Find\. Reserve\. Park\./ })).toBeVisible();
  await page.goto('/register');
  await page.getByLabel('Full name').fill(customer.name);
  await page.getByLabel('Email').fill(customer.email);
  await page.getByLabel('Password', { exact: true }).fill(customer.password);
  await page.getByLabel('Confirm password').fill(customer.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: /Priya/ })).toBeVisible();

  // Search parking
  await page.getByRole('link', { name: 'Find parking' }).first().click();
  await expect(page).toHaveURL(/\/parking/);
  await page.getByLabel('Search parking').fill('hitec');
  const card = page.getByRole('link', { name: /HITEC City Parking/ });
  await expect(card).toBeVisible();
  await expect(page.getByRole('link', { name: /CBIT Main Parking/ })).toHaveCount(0);
  await card.click();

  // Select a slot (HITEC City is open 24 hours, so the default time is always valid)
  await expect(page.getByRole('heading', { name: 'HITEC City Parking' })).toBeVisible();
  await expect(page.getByTestId('free-count')).toBeVisible();
  const bay = page.locator('button[data-status="available"]').first();
  const slotNumber = (await bay.locator('span.font-mono').innerText()).trim();
  await bay.click();
  await expect(page.getByTestId('selected-slot')).toHaveText(slotNumber);
  await page.getByRole('button', { name: /Review booking/ }).click();

  // Review: the price comes from the server
  await expect(page.getByRole('heading', { name: 'Review your booking' })).toBeVisible();
  await expect(page.getByTestId('total-amount')).toContainText('₹');
  await page.getByRole('button', { name: 'Confirm reservation' }).click();

  // Payment: fail once, then retry successfully
  await expect(page.getByRole('heading', { name: 'Complete your payment' })).toBeVisible();
  await page.getByRole('button', { name: /^Pay ₹/ }).click();
  await page.getByRole('button', { name: 'Simulate a failed payment' }).click();
  await expect(page.getByText('Payment failed.')).toBeVisible();
  await page.getByRole('button', { name: 'Retry payment' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Pay ₹/ }).click();

  // Confirmation
  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
  const bookingRef = (await page.getByTestId('booking-ref').innerText()).trim();
  expect(bookingRef).toMatch(/^SPK-/);

  // Notifications arrived (welcome + confirmation + payment)
  await expect(page.getByTestId('unread-count')).toHaveText('3');

  // Booking details and receipt
  await page.getByRole('link', { name: /View booking & receipt/ }).click();
  await expect(page.getByRole('heading', { name: `Booking ${bookingRef}` })).toBeVisible();
  await expect(page.getByText('Paid').first()).toBeVisible();
  await expect(page.getByTestId('booking-qr').locator('svg')).toBeVisible();

  // It is listed under "Upcoming" (or "Active" if it has already started) in My bookings
  await page.goto('/bookings');
  const upcoming = page.getByText(bookingRef);
  if (!(await upcoming.isVisible().catch(() => false))) await page.getByRole('tab', { name: /Active/ }).click();
  await expect(page.getByText(bookingRef)).toBeVisible();

  // The same slot can no longer be picked for that time
  await page.goto('/parking');
  await page.getByRole('link', { name: /HITEC City Parking/ }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^Slot ${slotNumber},`) })).toBeDisabled();

  // A customer cannot open the admin area
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
});

test('admin: dashboard → occupancy simulation → reservations → users → payments → reports', async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Revenue today')).toBeVisible();

  // Occupancy: marking a free bay as occupied raises the overall percentage
  await page.getByRole('link', { name: 'Occupancy', exact: true }).click();
  await expect(page.getByText('Simulation Mode')).toBeVisible();
  const overall = page.getByTestId('overall-occupancy');
  const before = parseFloat(await overall.innerText());
  await page.getByRole('radio', { name: /Mark Occupied/ }).click();
  const freeBay = page.locator('button[data-status="available"]').first();
  const label = await freeBay.getAttribute('aria-label');
  const slotNumber = label!.match(/^Slot ([^,]+),/)![1];
  await freeBay.click();
  const changed = page.getByRole('button', { name: new RegExp(`^Slot ${slotNumber},`) });
  await expect(changed).toHaveAttribute('data-status', 'occupied');
  await expect.poll(async () => parseFloat(await overall.innerText())).toBeGreaterThan(before);
  // Put it back so the test can be re-run.
  await page.getByRole('radio', { name: /Mark Available/ }).click();
  await changed.click();
  await expect(changed).toHaveAttribute('data-status', 'available');

  // Reservations: the customer's booking is searchable
  await page.getByRole('link', { name: 'Reservations', exact: true }).click();
  await page.getByLabel('Search reservations').fill(customer.email);
  await expect(page.getByRole('cell', { name: new RegExp(customer.name) })).toBeVisible();

  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page.getByRole('cell', { name: customer.email })).toBeVisible();

  await page.getByRole('link', { name: 'Payments', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
  await expect(page.getByRole('cell', { name: new RegExp(customer.name) }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page.getByText('Net revenue')).toBeVisible();

  await page.getByRole('link', { name: 'Parking areas', exact: true }).click();
  await expect(page.getByRole('link', { name: 'CBIT Main Parking' })).toBeVisible();
});
