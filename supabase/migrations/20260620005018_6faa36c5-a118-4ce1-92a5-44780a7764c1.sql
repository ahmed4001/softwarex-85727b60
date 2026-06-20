
INSERT INTO public.route_redirects (from_path, to_path, status_code, source)
VALUES
  ('/the-lord-of-the-rings-the-rings-of-power/', '/', 301, 'legacy-cleanup'),
  ('/jack-ryan-season-3-trailer-release-date-cast/', '/', 301, 'legacy-cleanup'),
  ('/creed-3-casting-date-of-release-and-more/', '/', 301, 'legacy-cleanup'),
  ('/avatar-the-way-of-water-release-date-story-trailer/', '/', 301, 'legacy-cleanup'),
  ('/yamaha-earbuds-review/', '/', 301, 'legacy-cleanup'),
  ('/galaxy-m32-prime-edition-4g-smartphone/', '/', 301, 'legacy-cleanup'),
  ('/vivo-t1-5g-reviews-and-specification/', '/', 301, 'legacy-cleanup')
ON CONFLICT (from_path) DO NOTHING;

INSERT INTO public.pages (slug, title, body, seo_title, seo_description, is_active, show_in_footer)
VALUES
  ('how-we-review',
   'How We Review Software',
   E'<h2>Our Review Methodology</h2><p>Every software listing on ReviewHunts goes through a transparent, multi-step evaluation process designed to give buyers honest, useful information.</p><h3>1. Independent Research</h3><p>Our editorial team gathers data from the vendor''s public website, documentation, pricing pages, and product changelogs. We verify each tool''s feature set, supported platforms, integrations, and current pricing tiers before publishing.</p><h3>2. Hands-on Evaluation</h3><p>Where possible, we sign up for free trials or demos to test core workflows ourselves. We score products across usability, value, support quality, integrations, and depth of features.</p><h3>3. Verified User Reviews</h3><p>User reviews are only published after we verify the reviewer''s identity (business email, LinkedIn, or domain ownership). Verified reviews are marked with a badge. We never accept payment to influence ratings.</p><h3>4. Aggregate Scoring</h3><p>The displayed rating is a weighted average of all verified user reviews. We do not edit ratings or remove negative reviews unless they violate our content policy.</p><h3>5. Continuous Updates</h3><p>Each listing displays a "Last updated" date. We refresh pricing, features, and ratings continuously as new data arrives.</p><h3>Editorial Independence</h3><p>Some links on ReviewHunts are affiliate links — see our <a href="/page/affiliate-disclosure">Affiliate Disclosure</a>. Affiliate relationships never affect rankings, ratings, or editorial coverage.</p>',
   'How We Review Software — Our Methodology | ReviewHunts',
   'How ReviewHunts evaluates software: independent research, hands-on testing, verified user reviews, and transparent scoring. No paid placements.',
   true, true),
  ('privacy-policy',
   'Privacy Policy',
   E'<p><em>Last updated: June 2026</em></p><p>This Privacy Policy explains how ReviewHunts collects, uses, and protects information when you use our website.</p><h3>Information We Collect</h3><ul><li>Account information you provide (name, email) when registering or submitting reviews.</li><li>Usage data such as pages viewed, search queries, and clicks, collected via standard analytics.</li><li>Cookies for authentication, preferences, and analytics.</li></ul><h3>How We Use Information</h3><ul><li>To operate and improve the service.</li><li>To verify the authenticity of reviews.</li><li>To send transactional emails and, if you opt in, newsletters.</li></ul><h3>Sharing</h3><p>We do not sell personal information. We share data only with service providers that help us run the site (hosting, email, analytics), under contract.</p><h3>Your Rights</h3><p>You may request access, correction, or deletion of your data by contacting us at privacy@reviewhunts.com.</p><h3>Contact</h3><p>Questions: <a href="/page/contact">Contact us</a>.</p>',
   'Privacy Policy | ReviewHunts',
   'How ReviewHunts collects, uses, and protects your information — what we collect, how we use it, your rights, and how to contact us.',
   true, true),
  ('affiliate-disclosure',
   'Affiliate Disclosure',
   E'<p><em>Last updated: June 2026</em></p><p>ReviewHunts is supported in part by affiliate partnerships. When you click certain outbound links to vendor websites and subsequently purchase a subscription, we may earn a commission at no additional cost to you.</p><h3>How affiliate links work</h3><p>Affiliate relationships are common across the software review industry. They allow us to keep ReviewHunts free for readers.</p><h3>Editorial independence</h3><p>Affiliate relationships do <strong>not</strong> influence:</p><ul><li>Which products we list or review.</li><li>The order in which products appear on category or comparison pages.</li><li>Star ratings, which are based exclusively on verified user reviews.</li><li>The contents of our editorial reviews or buyer guides.</li></ul><h3>Sponsored placements</h3><p>Any sponsored content on ReviewHunts is clearly labeled with an "AD" or "Sponsored" badge and is separated from editorial content.</p><h3>Questions</h3><p>See our <a href="/page/how-we-review">review methodology</a> or <a href="/page/contact">contact us</a>.</p>',
   'Affiliate Disclosure | ReviewHunts',
   'How ReviewHunts makes money through affiliate partnerships, and why those relationships never affect rankings, ratings, or editorial reviews.',
   true, true)
ON CONFLICT (slug) DO UPDATE SET
  body = EXCLUDED.body,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description,
  show_in_footer = EXCLUDED.show_in_footer,
  is_active = true,
  updated_at = now();
