-- =====================================================
-- Fix tasks status constraint to allow defect-specific statuses
-- The original constraint only had: open, in_progress, done, blocked
-- Defects need: open, in_progress, resolved, rejected (+ done, blocked)
-- =====================================================

-- Drop the existing status check constraint on tasks
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Re-add with expanded set of valid statuses
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN (
    'open',
    'in_progress',
    'done',
    'blocked',
    'resolved',
    'rejected',
    'review',
    'scheduled'
  ));
