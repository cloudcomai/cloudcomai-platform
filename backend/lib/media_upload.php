<?php

declare(strict_types=1);

/**
 * Return a safe, actionable message for a PHP upload error code.
 */
function cloudcomai_upload_error_message(int $error): string
{
    return match ($error) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'The selected media is larger than the server upload limit.',
        UPLOAD_ERR_PARTIAL => 'The media upload was interrupted. Please try again.',
        UPLOAD_ERR_NO_FILE => 'No media file was received.',
        UPLOAD_ERR_NO_TMP_DIR => 'The server could not prepare temporary upload storage.',
        UPLOAD_ERR_CANT_WRITE => 'The server could not write the uploaded media.',
        UPLOAD_ERR_EXTENSION => 'A server extension stopped the media upload.',
        default => 'The media upload failed before the file reached the application.',
    };
}

/**
 * Detect MIME type from the uploaded bytes without trusting the client-supplied MIME type.
 * Fileinfo is preferred, with PHP's mime_content_type as a compatibility fallback.
 */
function cloudcomai_detect_mime_type(string $path): string
{
    if (!is_file($path)) return '';

    if (function_exists('finfo_open')) {
        try {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo !== false) {
                $mime = finfo_file($finfo, $path);
                finfo_close($finfo);
                if (is_string($mime) && $mime !== '') return strtolower($mime);
            }
        } catch (Throwable) {
            // Fall through to mime_content_type when available.
        }
    }

    if (function_exists('mime_content_type')) {
        try {
            $mime = mime_content_type($path);
            if (is_string($mime) && $mime !== '') return strtolower($mime);
        } catch (Throwable) {
            // The caller will return a clear server-configuration error.
        }
    }

    return '';
}

/**
 * Stored Ring Bell media has already passed the upload MIME allow-list, so this is
 * a safe fallback for serving the file if MIME detection is unavailable later.
 */
function cloudcomai_media_mime_from_extension(string $filename): string
{
    $extension = strtolower((string)pathinfo($filename, PATHINFO_EXTENSION));
    return match ($extension) {
        'jpg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        'mp4' => 'video/mp4',
        'mov' => 'video/quicktime',
        'webm' => 'video/webm',
        default => '',
    };
}
