-- Fix route_label constraint: RouteE Compass returns eco/balanced/fastest,
-- not the original taken/alt_1/alt_2 labels.

ALTER TABLE route_comparisons DROP CONSTRAINT route_comparisons_route_label_check;
ALTER TABLE route_comparisons ADD CONSTRAINT route_comparisons_route_label_check
  CHECK (route_label IN ('eco', 'balanced', 'fastest'));
