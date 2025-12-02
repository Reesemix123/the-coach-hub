#!/bin/bash
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhd2NnbW9uZ25zd21yeGZzd2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTI4MzAsImV4cCI6MjA2NDA4ODgzMH0.hN8_Vgm5GxSVazYYIITjsHAR-7lZQKz5R6jqqXCPGQ0"
URL="https://bawcgmongnswmrxfsweh.supabase.co/rest/v1/player_participation"
QUERY="participation_type=in.(ol_lt,ol_lg,ol_c,ol_rg,ol_rt)&select=participation_type,result"

curl -s -H "apikey: ${API_KEY}" -H "Authorization: Bearer ${API_KEY}" "${URL}?${QUERY}"
