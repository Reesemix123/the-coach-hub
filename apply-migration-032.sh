#!/bin/bash
# Apply migration 032 to Supabase database

DB_URL="postgresql://postgres.gvzdsuodulrdbitxfvjw:gVw7RIATNWDRccAL@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

echo "=========================================="
echo "Applying Migration 032"
echo "=========================================="
echo ""
echo "This migration will:"
echo "  1. Create player_participation junction table"
echo "  2. Migrate existing array data to normalized structure"
echo "  3. Create optimized indexes for O(log n) queries"
echo "  4. Add RLS policies for security"
echo ""
echo "Press ENTER to continue or Ctrl+C to cancel"
read

# Try with psql first
if command -v psql &> /dev/null; then
    echo "Using psql..."
    psql "$DB_URL" -f supabase/migrations/032_create_player_participation_table.sql
elif command -v supabase &> /dev/null; then
    echo "Using supabase CLI..."
    supabase db execute --db-url "$DB_URL" < supabase/migrations/032_create_player_participation_table.sql
else
    echo "ERROR: Neither psql nor supabase CLI found."
    echo ""
    echo "Please install PostgreSQL client:"
    echo "  brew install postgresql@15"
    echo ""
    echo "Or use Supabase web dashboard:"
    echo "  1. Go to https://supabase.com/dashboard/project/gvzdsuodulrdbitxfvjw/sql/new"
    echo "  2. Copy contents of supabase/migrations/032_create_player_participation_table.sql"
    echo "  3. Paste and run"
    exit 1
fi

echo ""
echo "=========================================="
echo "Migration complete!"
echo "=========================================="
