-- Create ENUMs
CREATE TYPE occasion_type AS ENUM ('birthday', 'valentine', 'diwali', 'christmas', 'eid', 'holi', 'new_year', 'custom');
CREATE TYPE wish_status AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE notification_channel AS ENUM ('whatsapp', 'instagram', 'push');

-- Users table (Supabase handles auth, but we can store extra info)
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  instagram_access_token TEXT,
  whatsapp_api_key TEXT, -- User-wide CallMeBot key (optional if per contact)
  whatsapp_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT, -- partner/friend/family/colleague
  phone_number TEXT, -- with country code
  instagram_username TEXT,
  birthday DATE,
  anniversary DATE,
  callmebot_api_key TEXT, -- specific key if different
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wishes table
CREATE TABLE IF NOT EXISTS wishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES contacts ON DELETE CASCADE NOT NULL,
  occasion_type occasion_type NOT NULL,
  wish_message TEXT NOT NULL,
  media_url TEXT,
  scheduled_datetime TIMESTAMPTZ NOT NULL,
  channels JSONB DEFAULT '["whatsapp"]'::jsonb, -- Array of notification_channel
  status wish_status DEFAULT 'pending',
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT DEFAULT 'YEARLY', -- e.g., "YEARLY"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Logs
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wish_id UUID REFERENCES wishes ON DELETE CASCADE NOT NULL,
  channel notification_channel NOT NULL,
  status TEXT NOT NULL, -- 'sent' / 'failed'
  response_payload JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Devices (for Push Notifications)
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  fcm_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fcm_token)
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies (User can only see their own data)
CREATE POLICY "Users can view their own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own data" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage their contacts" ON contacts 
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their wishes" ON wishes 
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their notification logs" ON notification_logs 
FOR SELECT USING (EXISTS (SELECT 1 FROM wishes WHERE wishes.id = notification_logs.wish_id AND wishes.user_id = auth.uid()));

CREATE POLICY "Users can manage their devices" ON user_devices 
FOR ALL USING (auth.uid() = user_id);
