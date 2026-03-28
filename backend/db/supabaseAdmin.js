const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Ensure env vars are loaded for standalone scripts

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ADMIN_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_KEY is missing');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

module.exports = supabaseAdmin;
