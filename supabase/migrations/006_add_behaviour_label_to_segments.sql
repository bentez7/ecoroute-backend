-- Add behaviour_label and confidence columns to telemetry_segments.
--
-- behaviour_label stores the XGBoost 3-way classification returned by the ML
-- service (smooth / moderate / aggressive). This replaces the previous
-- intent of xgboost_efficiency_label for that purpose; xgboost_efficiency_label
-- is kept as a derived binary field (smooth → optimal, else → suboptimal) used
-- by the feedback-event pipeline.
--
-- confidence stores the model confidence score (0–1) for future thresholding.

ALTER TABLE telemetry_segments
  ADD COLUMN IF NOT EXISTS behaviour_label text,
  ADD COLUMN IF NOT EXISTS confidence float;
