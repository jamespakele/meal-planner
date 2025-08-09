-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE group_status AS ENUM ('active', 'inactive');
CREATE TYPE plan_status AS ENUM ('draft', 'collecting', 'finalized');
CREATE TYPE form_link_role AS ENUM ('co_manager', 'other');

-- Groups table
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    adults INTEGER NOT NULL DEFAULT 0 CHECK (adults >= 0),
    teens INTEGER NOT NULL DEFAULT 0 CHECK (teens >= 0),
    kids INTEGER NOT NULL DEFAULT 0 CHECK (kids >= 0),
    toddlers INTEGER NOT NULL DEFAULT 0 CHECK (toddlers >= 0),
    dietary_restrictions TEXT[] DEFAULT '{}',
    status group_status DEFAULT 'active',
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Meals table
CREATE TABLE meals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR NOT NULL,
    description TEXT,
    prep_time INTEGER DEFAULT 0, -- in minutes
    steps TEXT[] DEFAULT '{}',
    ingredients TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    starred BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Plans table
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_start DATE NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    status plan_status DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Plan meals table (finalized meal selections)
CREATE TABLE plan_meals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
    meal_id UUID REFERENCES meals(id) ON DELETE CASCADE NOT NULL,
    day VARCHAR NOT NULL, -- 'monday', 'tuesday', etc.
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(plan_id, day, meal_id)
);

-- Form links table (dual link system)
CREATE TABLE form_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
    public_token VARCHAR UNIQUE NOT NULL,
    role form_link_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(plan_id, role) -- Only one link per role per plan
);

-- Form responses table
CREATE TABLE form_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_link_id UUID REFERENCES form_links(id) ON DELETE CASCADE NOT NULL,
    form_link_role form_link_role NOT NULL, -- denormalized for easier querying
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    selections JSONB NOT NULL, -- meal selections data
    comments TEXT
);

-- Shopping lists table
CREATE TABLE shopping_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- categorized shopping list items
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(plan_id)
);

-- Adult Equivalent calculation function
CREATE OR REPLACE FUNCTION calculate_adult_equivalent(
    adults INTEGER,
    teens INTEGER, 
    kids INTEGER,
    toddlers INTEGER
) RETURNS DECIMAL AS $$
BEGIN
    RETURN (adults * 1.0) + (teens * 1.2) + (kids * 0.7) + (toddlers * 0.4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_meals_updated_at BEFORE UPDATE ON meals
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_plan_meals_updated_at BEFORE UPDATE ON plan_meals
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_shopping_lists_updated_at BEFORE UPDATE ON shopping_lists
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_groups_user_id ON groups(user_id);
CREATE INDEX idx_groups_status ON groups(status);
CREATE INDEX idx_plans_group_id ON plans(group_id);
CREATE INDEX idx_plans_week_start ON plans(week_start);
CREATE INDEX idx_plan_meals_plan_id ON plan_meals(plan_id);
CREATE INDEX idx_form_links_plan_id ON form_links(plan_id);
CREATE INDEX idx_form_links_token ON form_links(public_token);
CREATE INDEX idx_form_responses_form_link_id ON form_responses(form_link_id);
CREATE INDEX idx_shopping_lists_plan_id ON shopping_lists(plan_id);