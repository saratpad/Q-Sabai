import { Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useNavigate } from 'react-router-dom'

// BookingPage is used for /booking/:eventId (authenticated users)
export default function BookingPage() {
  // This is just a redirect wrapper - PublicBookingPage handles the actual logic
  const navigate = useNavigate()
  const { eventId } = { eventId: window.location.pathname.split('/').pop() }
  navigate(`/book/${eventId}`, { replace: true })
  return null
}
