-- 1. Create hardware_models table
CREATE TABLE IF NOT EXISTS public.hardware_models (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'General',
    file_url TEXT NOT NULL,
    icon TEXT DEFAULT 'memory',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.hardware_models ENABLE ROW LEVEL SECURITY;

-- 3. Policies
CREATE POLICY "Public can view models" ON public.hardware_models
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage models" ON public.hardware_models
    FOR ALL USING (auth.jwt() ->> 'email' = 'admin01@drillab.org');

-- 4. Initial Seed Data (using the local files we already have)
INSERT INTO public.hardware_models (name, description, category, file_url, icon)
VALUES 
('Rocket Engine', 'A high-fidelity model of a multi-stage rocket propulsion system.', 'Aerospace', '/rocket.glb', 'rocket_launch'),
('KUKA Robotic Arm', 'Industrial-grade 6-axis robotic arm used in precision manufacturing.', 'Robotics', '/robotic_arm_kuka.glb', 'precision_manufacturing'),
('Sample Device', 'An electronic component model for circuit simulation.', 'Electronics', '/sample_device.glb', 'memory')
ON CONFLICT DO NOTHING;
