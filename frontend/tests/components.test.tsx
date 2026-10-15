import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PriceBreakdown } from '../src/features/booking/PriceBreakdown';
import { customerVisual, liveVisual, SlotGrid } from '../src/features/parking/SlotGrid';
import { StatusBadge } from '../src/components/ui';
import { AuthProvider } from '../src/contexts/AuthContext';
import { Login } from '../src/pages/AuthPages';
import { RequireAuth } from '../src/routes/guards';
import type { Slot } from '../src/types';
import { formatDuration, fromInputs, money, nextHalfHour } from '../src/utils/format';

const slot = (over: Partial<Slot>): Slot => ({
  id: over.slotNumber ?? 'id', parkingAreaId: 'area', slotNumber: 'A-101', floor: '1', vehicleType: 'CAR', status: 'AVAILABLE',
  isEv: false, price: 40, customPrice: null, bookable: true, unavailableReason: null, ...over,
});
const SLOTS = [
  slot({ slotNumber: 'A-101' }),
  slot({ slotNumber: 'A-102', bookable: false, unavailableReason: 'Already booked for this time' }),
  slot({ slotNumber: 'A-103', status: 'OCCUPIED', bookable: false, unavailableReason: 'Currently occupied' }),
  slot({ slotNumber: 'A-104', status: 'MAINTENANCE', bookable: false, unavailableReason: 'Under maintenance' }),
];

function wrap(ui: ReactNode, route = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[route]}><AuthProvider>{ui}</AuthProvider></MemoryRouter></QueryClientProvider>);
}

describe('formatting helpers', () => {
  it('formats rupees without dropping the trailing zero', () => {
    expect(money(80)).toBe('₹80');
    expect(money(94.4)).toBe('₹94.40');
    expect(money(null)).toBe('—');
  });
  it('formats durations', () => {
    expect(formatDuration(2)).toBe('2 h');
    expect(formatDuration(1.5)).toBe('1 h 30 min');
    expect(formatDuration(0.5)).toBe('30 min');
  });
  it('builds dates from form inputs and finds the next half hour', () => {
    expect(fromInputs('2030-01-02', '09:30')?.getHours()).toBe(9);
    expect(fromInputs('', '09:30')).toBeNull();
    const next = nextHalfHour(10, new Date(2030, 0, 1, 10, 5));
    expect([next.getHours(), next.getMinutes()]).toEqual([10, 30]);
    const rolled = nextHalfHour(10, new Date(2030, 0, 1, 10, 25));
    expect([rolled.getHours(), rolled.getMinutes()]).toEqual([11, 0]);
  });
});

describe('SlotGrid', () => {
  it('maps slots to what a customer and an admin should see', () => {
    expect(SLOTS.map(customerVisual)).toEqual(['available', 'reserved', 'occupied', 'maintenance']);
    expect(SLOTS.map(liveVisual)).toEqual(['available', 'available', 'occupied', 'maintenance']);
  });

  it('lets a customer pick only available bays', async () => {
    const onSelect = vi.fn();
    render(<SlotGrid slots={SLOTS} visual={customerVisual} onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: /Slot A-102/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Slot A-103/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Slot A-104/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Slot A-101/ }));
    expect(onSelect).toHaveBeenCalledWith(SLOTS[0]);
  });

  it('marks the selected bay', () => {
    render(<SlotGrid slots={SLOTS} visual={customerVisual} selectedId="A-101" onSelect={() => undefined} />);
    expect(screen.getByRole('button', { name: /Slot A-101/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('PriceBreakdown and badges', () => {
  it('shows the amounts it is given', () => {
    render(<PriceBreakdown hourlyRate={40} billedHours={2} baseAmount={80} taxAmount={14.4} total={94.4} taxPercent={18} />);
    expect(screen.getByText('₹40 × 2 h')).toBeInTheDocument();
    expect(screen.getByText('Taxes (GST 18%)')).toBeInTheDocument();
    expect(screen.getByTestId('total-amount')).toHaveTextContent('₹94.40');
  });
  it('labels statuses in plain language', () => {
    render(<><StatusBadge status="PENDING" /><StatusBadge status="SUCCESS" kind="payment" /><StatusBadge status="CONFIRMED" /></>);
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });
});

describe('login form and route protection', () => {
  it('validates before calling the server', async () => {
    wrap(<Login />);
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('redirects anonymous visitors from protected pages to the login page', async () => {
    wrap(
      <Routes>
        <Route element={<RequireAuth />}><Route path="/bookings" element={<p>Secret bookings</p>} /></Route>
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>,
      '/bookings',
    );
    await waitFor(() => expect(screen.getByText('Login page')).toBeInTheDocument());
    expect(screen.queryByText('Secret bookings')).not.toBeInTheDocument();
  });
});
