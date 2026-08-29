# Database migrations

Version-controlled database migrations belong in this directory. Existing schema and migration utilities copied from `cloudcomai-backend` remain in `backend/sql` and `backend/scripts` until their execution order and production compatibility are mapped in the backend-integration milestone.

Production migrations must run only after a successful backup and must be followed by a health check with rollback on failure.

