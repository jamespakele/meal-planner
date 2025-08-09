-- Enable Row Level Security on all tables
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;

-- Groups policies - users can only access their own groups
CREATE POLICY "Users can view their own groups" ON groups
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own groups" ON groups
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own groups" ON groups
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own groups" ON groups
    FOR DELETE USING (auth.uid() = user_id);

-- Meals policies - meals are publicly readable but only manageable by authenticated users
CREATE POLICY "Anyone can view meals" ON meals
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert meals" ON meals
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update meals" ON meals
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete meals" ON meals
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Plans policies - users can only access plans for their groups
CREATE POLICY "Users can view plans for their groups" ON plans
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = plans.group_id
            AND groups.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert plans for their groups" ON plans
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = plans.group_id
            AND groups.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update plans for their groups" ON plans
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = plans.group_id
            AND groups.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete plans for their groups" ON plans
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = plans.group_id
            AND groups.user_id = auth.uid()
        )
    );

-- Plan meals policies - users can access plan meals for their groups
CREATE POLICY "Users can view plan meals for their groups" ON plan_meals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM plans p
            JOIN groups g ON g.id = p.group_id
            WHERE p.id = plan_meals.plan_id
            AND g.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert plan meals for their groups" ON plan_meals
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM plans p
            JOIN groups g ON g.id = p.group_id
            WHERE p.id = plan_meals.plan_id
            AND g.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update plan meals for their groups" ON plan_meals
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM plans p
            JOIN groups g ON g.id = p.group_id
            WHERE p.id = plan_meals.plan_id
            AND g.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete plan meals for their groups" ON plan_meals
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM plans p
            JOIN groups g ON g.id = p.group_id
            WHERE p.id = plan_meals.plan_id
            AND g.user_id = auth.uid()
        )
    );

-- Form links policies - users can access form links for their plans + public access via token
CREATE POLICY "Users can view form links for their plans" ON form_links
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM plans p
            JOIN groups g ON g.id = p.group_id
            WHERE p.id = form_links.plan_id
            AND g.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert form links for their plans" ON form_links
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM plans p
            JOIN groups g ON g.id = p.group_id
            WHERE p.id = form_links.plan_id
            AND g.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update form links for their plans" ON form_links
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM plans p
            JOIN groups g ON g.id = p.group_id
            WHERE p.id = form_links.plan_id
            AND g.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete form links for their plans" ON form_links
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM plans p
            JOIN groups g ON g.id = p.group_id
            WHERE p.id = form_links.plan_id
            AND g.user_id = auth.uid()
        )
    );

-- Form responses policies - users can view responses for their plans
CREATE POLICY "Users can view form responses for their plans" ON form_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM form_links fl
            JOIN plans p ON p.id = fl.plan_id
            JOIN groups g ON g.id = p.group_id
            WHERE fl.id = form_responses.form_link_id
            AND g.user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can insert form responses with valid token" ON form_responses
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM form_links
            WHERE form_links.id = form_responses.form_link_id
            AND (form_links.expires_at IS NULL OR form_links.expires_at > NOW())
        )
    );

-- Shopping lists policies - users can access shopping lists for their plans
CREATE POLICY "Users can view shopping lists for their plans" ON shopping_lists
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM plans p
            JOIN groups g ON g.id = p.group_id
            WHERE p.id = shopping_lists.plan_id
            AND g.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert shopping lists for their plans" ON shopping_lists
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM plans p
            JOIN groups g ON g.id = p.group_id
            WHERE p.id = shopping_lists.plan_id
            AND g.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update shopping lists for their plans" ON shopping_lists
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM plans p
            JOIN groups g ON g.id = p.group_id
            WHERE p.id = shopping_lists.plan_id
            AND g.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete shopping lists for their plans" ON shopping_lists
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM plans p
            JOIN groups g ON g.id = p.group_id
            WHERE p.id = shopping_lists.plan_id
            AND g.user_id = auth.uid()
        )
    );