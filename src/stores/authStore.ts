import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/database.types'

interface AuthState {
  user: Profile | null
  loading: boolean
  initialized: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    set({ loading: true })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        set({ user: profile, initialized: true })
      } else {
        set({ user: null, initialized: true })
      }
    } catch {
      set({ user: null, initialized: true })
    } finally {
      set({ loading: false })
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        set({ user: profile })
      } else if (event === 'SIGNED_OUT') {
        set({ user: null })
      }
    })
  },

  signInWithEmail: async (email, password) => {
    set({ loading: true })
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } finally {
      set({ loading: false })
    }
  },

  signUpWithEmail: async (email, password, displayName) => {
    set({ loading: true })
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: undefined,
        },
      })
      if (error) throw error

      // If email confirmation is disabled, user is logged in immediately
      // Create/upsert profile manually in case trigger hasn't fired yet
      if (data.user) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle()

        if (!existingProfile) {
          await supabase.from('profiles').insert({
            id: data.user.id,
            email: data.user.email!,
            display_name: displayName,
            role: 'attendee',
          })
        }
      }
    } finally {
      set({ loading: false })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },
}))
