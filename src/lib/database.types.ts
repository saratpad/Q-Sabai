export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          role: 'organizer' | 'attendee' | 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          role?: 'organizer' | 'attendee' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          avatar_url?: string | null
          role?: 'organizer' | 'attendee' | 'admin'
          created_at?: string
          updated_at?: string
        }
      }
      events: {
        Row: {
          id: string
          organizer_id: string
          title: string
          description: string | null
          banner_url: string | null
          queue_type: 'unlimited' | 'scheduled'
          status: 'active' | 'paused' | 'closed'
          settings: Json
          is_group: boolean
          parent_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organizer_id: string
          title: string
          description?: string | null
          banner_url?: string | null
          queue_type?: 'unlimited' | 'scheduled'
          status?: 'active' | 'paused' | 'closed'
          settings?: Json
          is_group?: boolean
          parent_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organizer_id?: string
          title?: string
          description?: string | null
          banner_url?: string | null
          queue_type?: 'unlimited' | 'scheduled'
          status?: 'active' | 'paused' | 'closed'
          settings?: Json
          is_group?: boolean
          parent_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      event_slots: {
        Row: {
          id: string
          event_id: string
          slot_date: string
          start_time: string
          end_time: string
          capacity: number
          booked_count: number
          status: 'open' | 'full' | 'closed'
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          slot_date: string
          start_time: string
          end_time: string
          capacity?: number
          booked_count?: number
          status?: 'open' | 'full' | 'closed'
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          slot_date?: string
          start_time?: string
          end_time?: string
          capacity?: number
          booked_count?: number
          status?: 'open' | 'full' | 'closed'
          created_at?: string
        }
      }
      custom_fields: {
        Row: {
          id: string
          event_id: string
          label: string
          field_type: 'text' | 'phone' | 'select' | 'email' | 'number'
          options: Json
          is_required: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          label: string
          field_type?: 'text' | 'phone' | 'select' | 'email' | 'number'
          options?: Json
          is_required?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          label?: string
          field_type?: 'text' | 'phone' | 'select' | 'email' | 'number'
          options?: Json
          is_required?: boolean
          sort_order?: number
          created_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          event_id: string
          slot_id: string | null
          user_id: string
          queue_number: number
          status: 'waiting' | 'called' | 'present' | 'absent' | 'cancelled'
          field_responses: Json
          called_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          slot_id?: string | null
          user_id: string
          queue_number?: number
          status?: 'waiting' | 'called' | 'present' | 'absent' | 'cancelled'
          field_responses?: Json
          called_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          slot_id?: string | null
          user_id?: string
          queue_number?: number
          status?: 'waiting' | 'called' | 'present' | 'absent' | 'cancelled'
          field_responses?: Json
          called_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      queue_sessions: {
        Row: {
          id: string
          event_id: string
          current_numbers: number[]
          call_count_per_round: number
          show_name: boolean
          language: 'th' | 'en'
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          current_numbers?: number[]
          call_count_per_round?: number
          show_name?: boolean
          language?: 'th' | 'en'
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          current_numbers?: number[]
          call_count_per_round?: number
          show_name?: boolean
          language?: 'th' | 'en'
          updated_at?: string
        }
      }
      line_settings: {
        Row: {
          id: string
          event_id: string
          channel_access_token: string | null
          group_id: string | null
          notify_before_minutes: number
          notify_on_call: boolean
          notify_on_available: boolean
          notify_on_close: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          channel_access_token?: string | null
          group_id?: string | null
          notify_before_minutes?: number
          notify_on_call?: boolean
          notify_on_available?: boolean
          notify_on_close?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          channel_access_token?: string | null
          group_id?: string | null
          notify_before_minutes?: number
          notify_on_call?: boolean
          notify_on_available?: boolean
          notify_on_close?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Event = Database['public']['Tables']['events']['Row']
export type EventSlot = Database['public']['Tables']['event_slots']['Row']
export type CustomField = Database['public']['Tables']['custom_fields']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']
export type QueueSession = Database['public']['Tables']['queue_sessions']['Row']
export type LineSettings = Database['public']['Tables']['line_settings']['Row']

// Extended types
export type BookingWithProfile = Booking & {
  profiles: Profile
  event_slots: EventSlot | null
}

export type EventWithDetails = Event & {
  event_slots?: EventSlot[]
  custom_fields?: CustomField[]
  bookings?: Booking[]
}
