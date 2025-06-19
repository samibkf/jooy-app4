/*
  # Create worksheets and regions tables

  1. New Tables
    - `worksheets`
      - `id` (text, primary key)
      - `document_name` (text, not null)
      - `document_id` (text, not null)
      - `drm_protected` (boolean, default false)
      - `drm_protected_pages` (integer array, default empty)
      - `created_at` (timestamp with time zone, default now())
      - `updated_at` (timestamp with time zone, default now())
    
    - `regions`
      - `id` (uuid, primary key, auto-generated)
      - `worksheet_id` (text, foreign key to worksheets.id)
      - `page` (integer, not null)
      - `x` (double precision, not null)
      - `y` (double precision, not null)
      - `width` (double precision, not null)
      - `height` (double precision, not null)
      - `type` (text, default 'region')
      - `name` (text, not null)
      - `description` (text array, nullable)
      - `created_at` (timestamp with time zone, default now())
      - `updated_at` (timestamp with time zone, default now())

  2. Security
    - Enable RLS on both tables
    - Add policies for public read access (since these appear to be public worksheets)
    - Add admin policies for full management

  3. Triggers
    - Add updated_at triggers for both tables
*/

-- Create worksheets table
CREATE TABLE IF NOT EXISTS public.worksheets (
  id text PRIMARY KEY,
  document_name text NOT NULL,
  document_id text NOT NULL,
  drm_protected boolean DEFAULT false,
  drm_protected_pages integer[] DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create regions table
CREATE TABLE IF NOT EXISTS public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id text NOT NULL REFERENCES public.worksheets(id) ON DELETE CASCADE,
  page integer NOT NULL,
  x double precision NOT NULL,
  y double precision NOT NULL,
  width double precision NOT NULL,
  height double precision NOT NULL,
  type text DEFAULT 'region',
  name text NOT NULL,
  description text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_regions_worksheet_id ON public.regions(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_regions_page ON public.regions(worksheet_id, page);

-- Create or replace the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_worksheets_updated_at ON public.worksheets;
CREATE TRIGGER update_worksheets_updated_at
  BEFORE UPDATE ON public.worksheets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_regions_updated_at ON public.regions;
CREATE TRIGGER update_regions_updated_at
  BEFORE UPDATE ON public.regions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

-- Create policies for worksheets (public read access)
CREATE POLICY "Allow public read access to worksheets"
  ON public.worksheets
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow admin full access to worksheets"
  ON public.worksheets
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create policies for regions (public read access)
CREATE POLICY "Allow public read access to regions"
  ON public.regions
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow admin full access to regions"
  ON public.regions
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Insert sample data for the ABCDE worksheet if it doesn't exist
INSERT INTO public.worksheets (id, document_name, document_id, drm_protected, drm_protected_pages)
VALUES ('ABCDE', 'Sample Worksheet', 'ABCDE', false, '{}')
ON CONFLICT (id) DO NOTHING;

-- Insert sample regions for the ABCDE worksheet
INSERT INTO public.regions (worksheet_id, page, x, y, width, height, type, name, description) VALUES
('ABCDE', 1, 100, 100, 200, 50, 'text', 'Region 1-1', ARRAY['Sample region on page 1']),
('ABCDE', 1, 100, 200, 200, 50, 'text', 'Region 1-2', ARRAY['Another region on page 1']),
('ABCDE', 2, 150, 150, 180, 60, 'text', 'Region 2-1', ARRAY['Sample region on page 2'])
ON CONFLICT DO NOTHING;