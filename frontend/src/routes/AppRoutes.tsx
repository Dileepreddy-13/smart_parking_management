import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Spinner } from '../components/ui';
import { AdminLayout } from '../layouts/AdminLayout';
import { PublicLayout } from '../layouts/PublicLayout';
import { UserLayout } from '../layouts/UserLayout';
import { Login, Register } from '../pages/AuthPages';
import { Booking } from '../pages/Booking';
import { BookingDetails } from '../pages/BookingDetails';
import { Bookings } from '../pages/Bookings';
import { Dashboard } from '../pages/Dashboard';
import { Landing } from '../pages/Landing';
import { Forbidden, NotFound } from '../pages/Misc';
import { Notifications } from '../pages/Notifications';
import { ParkingDetails } from '../pages/ParkingDetails';
import { ParkingSearch } from '../pages/ParkingSearch';
import { Profile } from '../pages/Profile';
import { GuestOnly, RequireAuth } from './guards';

// The admin console is loaded on demand so customers never download it.
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminNotifications = lazy(() => import('../pages/admin/AdminNotifications').then((m) => ({ default: m.AdminNotifications })));
const AdminOccupancy = lazy(() => import('../pages/admin/AdminOccupancy').then((m) => ({ default: m.AdminOccupancy })));
const AdminParking = lazy(() => import('../pages/admin/AdminParking').then((m) => ({ default: m.AdminParking })));
const AdminParkingDetail = lazy(() => import('../pages/admin/AdminParkingDetail').then((m) => ({ default: m.AdminParkingDetail })));
const AdminPayments = lazy(() => import('../pages/admin/AdminPayments').then((m) => ({ default: m.AdminPayments })));
const AdminReports = lazy(() => import('../pages/admin/AdminReports').then((m) => ({ default: m.AdminReports })));
const AdminReservations = lazy(() => import('../pages/admin/AdminReservations').then((m) => ({ default: m.AdminReservations })));
const AdminSlots = lazy(() => import('../pages/admin/AdminSlots').then((m) => ({ default: m.AdminSlots })));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers').then((m) => ({ default: m.AdminUsers })));


export function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
      </Route>

      <Route element={<GuestOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<UserLayout />}>
        {/* Searching and viewing parking is public; everything else needs an account. */}
        <Route path="/parking" element={<ParkingSearch />} />
        <Route path="/parking/:id" element={<ParkingDetails />} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/booking/:id" element={<Booking />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/bookings/:id" element={<BookingDetails />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      <Route element={<RequireAuth role="ADMIN" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="parking" element={<AdminParking />} />
          <Route path="parking/:id" element={<AdminParkingDetail />} />
          <Route path="slots" element={<AdminSlots />} />
          <Route path="reservations" element={<AdminReservations />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="occupancy" element={<AdminOccupancy />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="reports" element={<AdminReports />} />
        </Route>
      </Route>

      <Route path="/forbidden" element={<Forbidden />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}
