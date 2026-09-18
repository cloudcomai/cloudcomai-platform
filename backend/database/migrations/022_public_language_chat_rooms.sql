-- Public language chat rooms extend the existing public-room model.
ALTER TABLE chats
    ADD COLUMN room_type ENUM('city','language') NOT NULL DEFAULT 'city' AFTER group_category,
    ADD COLUMN language_code VARCHAR(16) NULL AFTER room_type,
    ADD INDEX idx_chats_room_type_language (room_type, language_code);

UPDATE chats
SET room_type='city'
WHERE type='public' AND (group_category='india-city' OR room_type IS NULL);


-- Language public rooms. The stable language_code is used for search and room identity.
INSERT INTO chats(type,name,group_category,room_type,language_code,owner_id,retention_seconds,created_at)
SELECT 'public',v.name,'language','language',v.code,NULL,14400,UTC_TIMESTAMP()
FROM (
    SELECT 'French' AS name,'fr' AS code
    UNION ALL SELECT 'Spanish','es'
    UNION ALL SELECT 'Arabic','ar'
    UNION ALL SELECT 'Assamese','as'
    UNION ALL SELECT 'Bengali','bn'
    UNION ALL SELECT 'Gujarati','gu'
    UNION ALL SELECT 'Hindi','hi'
    UNION ALL SELECT 'Kannada','kn'
    UNION ALL SELECT 'Kashmiri','ks'
    UNION ALL SELECT 'Konkani','kok'
    UNION ALL SELECT 'Malayalam','ml'
    UNION ALL SELECT 'Manipuri (Meitei)','mni'
    UNION ALL SELECT 'Marathi','mr'
    UNION ALL SELECT 'Nepali','ne'
    UNION ALL SELECT 'Odia','or'
    UNION ALL SELECT 'Punjabi','pa'
    UNION ALL SELECT 'Sanskrit','sa'
    UNION ALL SELECT 'Sindhi','sd'
    UNION ALL SELECT 'Tamil','ta'
    UNION ALL SELECT 'Telugu','te'
    UNION ALL SELECT 'Urdu','ur'
) v
WHERE NOT EXISTS (
    SELECT 1 FROM chats c WHERE c.type='public' AND c.room_type='language' AND c.language_code=v.code
);
