ALTER TABLE "LiveSession"
  ADD COLUMN "jitsiRoomName" TEXT,
  ADD COLUMN "jitsiJoinUrl" TEXT;

UPDATE "LiveSession"
SET
  "jitsiRoomName" = "zoomMeetingId",
  "jitsiJoinUrl" = "zoomJoinUrl"
WHERE "jitsiRoomName" IS NULL;

CREATE INDEX "LiveSession_tenantId_jitsiRoomName_idx" ON "LiveSession"("tenantId", "jitsiRoomName");
