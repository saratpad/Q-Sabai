-- ==============================================================================
-- Admin RPC Functions for Q-Sabai
-- This file creates safe server-side functions to manage auth users without 
-- exposing the Service Role Key to the browser.
-- ==============================================================================

-- Function to safely delete a user (only callable by admins)
CREATE OR REPLACE FUNCTION delete_user_by_admin(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Security Check: Only allow if the caller is an admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied. Only admins can delete users.';
  END IF;
  
  -- 2. Delete the user from auth.users (this will cascade to profiles)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
