-- Enable Supabase Realtime on feedback_events so the frontend can subscribe
-- to live driving alerts via WebSocket during an active trip.

ALTER PUBLICATION supabase_realtime ADD TABLE feedback_events;
