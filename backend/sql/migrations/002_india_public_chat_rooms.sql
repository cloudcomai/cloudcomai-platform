-- Seed the fixed India public city/town rooms for existing installations.
-- Idempotent: each room is inserted only when its public-room name does not exist.
INSERT INTO chats(type,name,group_category,owner_id,retention_seconds,created_at)
SELECT 'public', v.name, 'india-city', NULL, 14400, UTC_TIMESTAMP()
FROM (
    SELECT 'Ahmedabad' AS name UNION ALL SELECT 'Agra' UNION ALL SELECT 'Amritsar' UNION ALL SELECT 'Bengaluru' UNION ALL SELECT 'Bareilly' UNION ALL
    SELECT 'Bhopal' UNION ALL SELECT 'Bhubaneswar' UNION ALL SELECT 'Chandigarh' UNION ALL SELECT 'Chennai' UNION ALL SELECT 'Coimbatore' UNION ALL
    SELECT 'Dehradun' UNION ALL SELECT 'Delhi' UNION ALL SELECT 'Faridabad' UNION ALL SELECT 'Ghaziabad' UNION ALL SELECT 'Guwahati' UNION ALL
    SELECT 'Gwalior' UNION ALL SELECT 'Hubballi' UNION ALL SELECT 'Hyderabad' UNION ALL SELECT 'Indore' UNION ALL SELECT 'Jaipur' UNION ALL
    SELECT 'Jabalpur' UNION ALL SELECT 'Jodhpur' UNION ALL SELECT 'Kanpur' UNION ALL SELECT 'Kochi' UNION ALL SELECT 'Kolkata' UNION ALL
    SELECT 'Kota' UNION ALL SELECT 'Lucknow' UNION ALL SELECT 'Ludhiana' UNION ALL SELECT 'Madurai' UNION ALL SELECT 'Meerut' UNION ALL
    SELECT 'Mumbai' UNION ALL SELECT 'Mysuru' UNION ALL SELECT 'Nagpur' UNION ALL SELECT 'Nashik' UNION ALL SELECT 'Patna' UNION ALL
    SELECT 'Pune' UNION ALL SELECT 'Raipur' UNION ALL SELECT 'Rajkot' UNION ALL SELECT 'Ranchi' UNION ALL SELECT 'Salem' UNION ALL
    SELECT 'Srinagar' UNION ALL SELECT 'Surat' UNION ALL SELECT 'Thiruvananthapuram' UNION ALL SELECT 'Tiruchirappalli' UNION ALL SELECT 'Tiruppur' UNION ALL
    SELECT 'Vadodara' UNION ALL SELECT 'Varanasi' UNION ALL SELECT 'Vijayawada' UNION ALL SELECT 'Visakhapatnam' UNION ALL SELECT 'Warangal'
) v
WHERE NOT EXISTS (
    SELECT 1 FROM chats c WHERE c.type='public' AND c.group_category='india-city' AND c.name=v.name
);
