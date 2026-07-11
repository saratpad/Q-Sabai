import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/authStore'
import { useSystemStore } from './stores/systemStore'

// Pages
import LoginPage from './pages/auth/LoginPage'
import OrganizerLayout from './pages/organizer/OrganizerLayout'
import OrganizerDashboard from './pages/organizer/OrganizerDashboard'
import EventDetailPage from './pages/organizer/EventDetailPage'
import CreateEventPage from './pages/organizer/CreateEventPage'
import EditEventPage from './pages/organizer/EditEventPage'
import QueueDisplayPage from './pages/organizer/QueueDisplayPage'
import QueueControlPage from './pages/organizer/QueueControlPage'
import BookingLayout from './pages/booking/BookingLayout'
import BookingPage from './pages/booking/BookingPage'
import PublicBookingPage from './pages/booking/PublicBookingPage'
import ProfilePage from './pages/profile/ProfilePage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminSettingsPage from './pages/admin/AdminSettingsPage'

function App() {
  const { initialize, user, initialized: authInitialized } = useAuthStore()
  const { fetchSettings, systemName, systemDesc, loading: systemLoading } = useSystemStore()

  useEffect(() => {
    initialize()
    fetchSettings()
  }, [initialize, fetchSettings])

  useEffect(() => {
    document.title = `${systemName}${systemDesc ? ` — ${systemDesc}` : ''}`
  }, [systemName, systemDesc])

  if (!authInitialized || systemLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0f1e',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <div className="spinner spinner-lg" />
        <p style={{ color: '#94a3b8', fontSize: '0.9375rem' }}>กำลังโหลด {systemName}...</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a2235',
            color: '#f1f5f9',
            border: '1px solid rgba(148,163,184,0.1)',
            borderRadius: '12px',
            fontFamily: 'Sarabun, sans-serif',
            fontSize: '0.9375rem',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#0a0f1e' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#0a0f1e' },
          },
        }}
      />
      <Routes>
        {/* Auth */}
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/organizer" replace />} />

        {/* Public booking page (no auth needed to view, auth needed to book) */}
        <Route path="/book/:eventId" element={<PublicBookingPage />} />

        {/* Queue display (public - for big screen) */}
        <Route path="/display/:eventId" element={<QueueDisplayPage />} />

        {/* Organizer routes (includes profile & admin under same layout) */}
        <Route path="/organizer" element={user ? <OrganizerLayout /> : <Navigate to="/login" replace />}>
          <Route index element={<OrganizerDashboard />} />
          <Route path="events/new" element={<CreateEventPage />} />
          <Route path="events/:eventId" element={<EventDetailPage />} />
          <Route path="events/:eventId/edit" element={<EditEventPage />} />
          <Route path="events/:eventId/control" element={<QueueControlPage />} />
        </Route>

        {/* Profile & Admin (same sidebar layout) */}
        <Route path="/profile" element={user ? <OrganizerLayout /> : <Navigate to="/login" replace />}>
          <Route index element={<ProfilePage />} />
        </Route>
        <Route path="/admin" element={user?.role === 'admin' ? <OrganizerLayout /> : <Navigate to="/organizer" replace />}>
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>

        {/* Booking redirect */}
        <Route path="/booking" element={user ? <BookingLayout /> : <Navigate to="/login" replace />}>
          <Route path=":eventId" element={<BookingPage />} />
        </Route>

        {/* Default redirect — always go to dashboard */}
        <Route path="/" element={<Navigate to={user ? '/organizer' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={user ? '/organizer' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
