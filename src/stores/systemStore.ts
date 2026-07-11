import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface SystemState {
  systemName: string
  systemDesc: string
  loading: boolean
  fetchSettings: () => Promise<void>
  setSystemSettings: (name: string, desc: string) => Promise<boolean>
}

export const useSystemStore = create<SystemState>((set) => ({
  systemName: 'Q-Sabai',
  systemDesc: 'ระบบจัดคิว สลน.',
  loading: true,
  fetchSettings: async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'system_name')
        .maybeSingle()

      if (error) {
        console.error('Error fetching system settings:', error)
        return
      }

      if (data && data.value) {
        const val = data.value as any
        if (val.name) set({ systemName: val.name })
        if (val.description !== undefined) set({ systemDesc: val.description })
      }
    } catch (err) {
      console.error('Failed to fetch system settings:', err)
    } finally {
      set({ loading: false })
    }
  },
  setSystemSettings: async (name: string, desc: string) => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'system_name', value: { name, description: desc } })

      if (error) throw error
      
      set({ systemName: name, systemDesc: desc })
      return true
    } catch (err) {
      console.error('Failed to update system name:', err)
      return false
    }
  }
}))
