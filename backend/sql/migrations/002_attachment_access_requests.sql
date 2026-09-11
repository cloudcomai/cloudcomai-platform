-- Make sender approval specific to the attachment, requesting user, and action.
ALTER TABLE attachment_download_requests
  ADD COLUMN request_type ENUM('DOWNLOAD','FORWARD') NOT NULL DEFAULT 'DOWNLOAD' AFTER sender_id;
ALTER TABLE attachment_download_requests
  DROP INDEX uq_attachment_request,
  ADD UNIQUE KEY uq_attachment_request_action(attachment_id,requester_id,request_type),
  ADD INDEX requester_action_status(requester_id,request_type,status);
