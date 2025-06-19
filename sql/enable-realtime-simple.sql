-- Simple real-time setup (no RLS required)
-- This works because we use service role key which bypasses RLS

-- Enable real-time replication for posts table
ALTER TABLE posts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE posts;

-- Enable real-time replication for post_analytics table  
ALTER TABLE post_analytics REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE post_analytics;

-- Optional: Disable RLS if you don't need user-level security
-- ALTER TABLE posts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE post_analytics DISABLE ROW LEVEL SECURITY;

-- Note: Service role key bypasses RLS anyway, so these policies are not needed
-- for real-time subscriptions, but keep them if you have frontend direct access 