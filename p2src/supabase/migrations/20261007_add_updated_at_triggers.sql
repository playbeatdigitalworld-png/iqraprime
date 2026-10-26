-- ============================================================================
-- AETHER STREAM — ADD UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_users_profile_data_updated_at BEFORE UPDATE ON users_profile_data FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_private_members_updated_at BEFORE UPDATE ON private_members FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_star_iptv_config_updated_at BEFORE UPDATE ON star_iptv_config FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_movies_updated_at BEFORE UPDATE ON movies FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_takedown_requests_updated_at BEFORE UPDATE ON takedown_requests FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
