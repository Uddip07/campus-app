-- Row Level Security (RLS) Policies for Campus Platform

-- 1. Enable RLS on all core tables
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE anonymous_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_devices ENABLE ROW LEVEL SECURITY;

-- 2. Helper security functions for JWT-based session checks
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_cohort_id()
RETURNS UUID AS $$
  SELECT cohort_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_user_active()
RETURNS BOOLEAN AS $$
  SELECT status = 'active' FROM users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_user_muted_or_banned()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM bans 
    WHERE user_id = auth.uid() 
      AND (expires_at IS NULL OR expires_at > now())
  ) OR EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND status IN ('suspended', 'banned')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Cohorts policies
CREATE POLICY cohorts_read_policy ON cohorts
  FOR SELECT TO authenticated
  USING (true);

-- 4. Rooms policies
-- Global room: accessible to all verified users
-- Cohort room: accessible ONLY if student belongs to that cohort
-- Alumni room: accessible ONLY if user role is alumni
CREATE POLICY rooms_read_policy ON rooms
  FOR SELECT TO authenticated
  USING (
    type = 'global'
    OR (type = 'cohort' AND cohort_id = current_user_cohort_id())
    OR (type = 'alumni' AND current_user_role() = 'alumni')
    OR current_user_role() IN ('moderator', 'admin', 'super_admin')
  );

-- 5. Messages policies
-- Read messages in accessible rooms where message is not removed
CREATE POLICY messages_read_policy ON messages
  FOR SELECT TO authenticated
  USING (
    moderation_status != 'removed'
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = messages.room_id
        AND (
          r.type = 'global'
          OR (r.type = 'cohort' AND r.cohort_id = current_user_cohort_id())
          OR (r.type = 'alumni' AND current_user_role() = 'alumni')
          OR current_user_role() IN ('moderator', 'admin', 'super_admin')
        )
    )
  );

-- Insert messages: only in authorized rooms, only if sender matches session, active, and not muted/banned
CREATE POLICY messages_insert_policy ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_user_active()
    AND NOT is_user_muted_or_banned()
    AND EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = room_id
        AND (
          r.type = 'global'
          OR (r.type = 'cohort' AND r.cohort_id = current_user_cohort_id())
          OR (r.type = 'alumni' AND current_user_role() = 'alumni')
        )
    )
  );

-- Soft delete own message or moderator action
CREATE POLICY messages_update_policy ON messages
  FOR UPDATE TO authenticated
  USING (
    (sender_id = auth.uid() AND deleted_at IS NULL)
    OR current_user_role() IN ('moderator', 'admin', 'super_admin')
  );

-- 6. Message Reactions policies
CREATE POLICY reactions_read_policy ON message_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN rooms r ON r.id = m.room_id
      WHERE m.id = message_reactions.message_id
        AND (
          r.type = 'global'
          OR (r.type = 'cohort' AND r.cohort_id = current_user_cohort_id())
          OR (r.type = 'alumni' AND current_user_role() = 'alumni')
          OR current_user_role() IN ('moderator', 'admin', 'super_admin')
        )
    )
  );

CREATE POLICY reactions_insert_policy ON message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_user_active()
    AND NOT is_user_muted_or_banned()
  );

CREATE POLICY reactions_delete_policy ON message_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 7. Reports policies
CREATE POLICY reports_insert_policy ON reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND is_user_active()
  );

CREATE POLICY reports_moderator_policy ON reports
  FOR ALL TO authenticated
  USING (current_user_role() IN ('moderator', 'admin', 'super_admin'));

-- 8. Announcements policies
-- Students view published, non-expired announcements matching their audience
CREATE POLICY announcements_read_policy ON announcements
  FOR SELECT TO authenticated
  USING (
    published_at IS NOT NULL
    AND published_at <= now()
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      audience_type = 'all'
      OR (audience_type = 'cohort' AND cohort_id = current_user_cohort_id())
      OR (audience_type = 'alumni' AND current_user_role() = 'alumni')
      OR current_user_role() IN ('admin', 'super_admin')
    )
  );

-- Only admins/super_admins can create, modify, delete announcements
CREATE POLICY announcements_admin_policy ON announcements
  FOR ALL TO authenticated
  USING (current_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (
    author_id = auth.uid()
    AND current_user_role() IN ('admin', 'super_admin')
  );

-- 9. Announcement Attachments policies
CREATE POLICY attachments_read_policy ON announcement_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM announcements a
      WHERE a.id = announcement_attachments.announcement_id
        AND (
          (a.published_at IS NOT NULL AND a.published_at <= now() AND (a.expires_at IS NULL OR a.expires_at > now())
           AND (a.audience_type = 'all' OR (a.audience_type = 'cohort' AND a.cohort_id = current_user_cohort_id()) OR (a.audience_type = 'alumni' AND current_user_role() = 'alumni')))
          OR current_user_role() IN ('admin', 'super_admin')
        )
    )
  );

CREATE POLICY attachments_admin_policy ON announcement_attachments
  FOR ALL TO authenticated
  USING (current_user_role() IN ('admin', 'super_admin'));

-- 10. Users policies: users can read only their own profile
CREATE POLICY users_read_own_policy ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR current_user_role() = 'super_admin');

-- 11. Anonymous identities: users can only see their own identity mapping
CREATE POLICY anonymous_identities_own_policy ON anonymous_identities
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR current_user_role() = 'super_admin');

-- 12. Bans policies
CREATE POLICY bans_read_policy ON bans
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR current_user_role() IN ('moderator', 'admin', 'super_admin'));

-- 13. Audit logs: super_admin only
CREATE POLICY audit_logs_policy ON audit_logs
  FOR SELECT TO authenticated
  USING (current_user_role() = 'super_admin');

-- 14. Notification devices
CREATE POLICY notification_devices_policy ON notification_devices
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
