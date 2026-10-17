-- Optional labelled shape drawn for each generated question, e.g.
-- {"shape": "rectangle", "labels": {"width": "{l} cm", "height": "{w} cm"}}. The math-service draws it as SVG.
ALTER TABLE math_template_versions ADD COLUMN figure JSONB CHECK (figure IS NULL OR jsonb_typeof(figure) = 'object');

-- The drawn figure is kept with the question, like its prompt, so past attempts show what the student saw.
ALTER TABLE attempt_items ADD COLUMN figure_svg TEXT;
