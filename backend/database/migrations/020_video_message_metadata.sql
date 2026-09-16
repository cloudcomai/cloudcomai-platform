-- Video-message metadata for generated chat thumbnails and aspect-ratio-safe playback.
ALTER TABLE message_attachments
    ADD COLUMN thumbnail_filename VARCHAR(255) NULL AFTER storage_path,
    ADD COLUMN thumbnail_path VARCHAR(500) NULL AFTER thumbnail_filename,
    ADD COLUMN width INT UNSIGNED NULL AFTER file_size,
    ADD COLUMN height INT UNSIGNED NULL AFTER width,
    ADD COLUMN duration_seconds DECIMAL(10,3) NULL AFTER height;
