ALTER TABLE upload_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access upload_logs" ON upload_logs FOR ALL USING (true) WITH CHECK (true);
