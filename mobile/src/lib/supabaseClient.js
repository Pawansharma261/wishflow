import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://llqmetaphnxyjtxzdegd.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxscW1ldGFwaG54eWp0eHpkZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTA0NDMsImV4cCI6MjA4OTI4NjQ0M30.G6OzpCzQDOMz8XGikYHsjvtt7dgSoxwB_WJz21M2t7k'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
