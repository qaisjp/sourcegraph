-- This migration was generated by the command `sg telemetry add`
DELETE FROM event_logs_export_allowlist WHERE event_name IN (SELECT * FROM UNNEST('{TourShown,TourClosed,TourStepClicked,TourRestartClicked,TourCompleted,TourSetupShown,TourSetupCompleted,TourSetupSkipped}'::TEXT[]));