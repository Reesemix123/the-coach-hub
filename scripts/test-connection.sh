#!/bin/bash

API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhd2NnbW9uZ25zd21yeGZzd2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTI4MzAsImV4cCI6MjA2NDA4ODgzMH0.hN8_Vgm5GxSVazYYIITjsHAR-7lZQKz5R6jqqXCPGQ0"

echo "Testing Supabase connection..."
curl -s "https://bawcgmongnswmrxfsweh.supabase.co/rest/v1/playbook_plays?team_id=eq.99ef9d88-454e-42bf-8f52-04d37b34a9d6&select=play_code&limit=5" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}"

echo ""
echo "Done"
