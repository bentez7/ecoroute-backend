-- Add a severity column to feedback_events so the mobile UI can pick a
-- banner style without re-deriving one from event_type. The backend
-- (FeedbackEventService.bulkInsertFromSegments) populates this on insert
-- via the EVENT_TYPE_TO_SEVERITY mapping; rows already in the table
-- predate this column and are backfilled with the same defaults.

alter table public.feedback_events
  add column if not exists severity text
  check (severity in ('info', 'warning', 'critical'));

update public.feedback_events
  set severity = case event_type
    when 'harsh_accel'    then 'warning'
    when 'harsh_brake'    then 'warning'
    when 'idling'         then 'info'
    when 'speed_variance' then 'info'
    else                       'info'
  end
where severity is null;
