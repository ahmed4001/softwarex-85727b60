
CREATE OR REPLACE FUNCTION public.db_perf_smoke()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  required_indexes text[] := ARRAY[
    'products:idx_products_slug',
    'products:idx_products_status',
    'products:idx_products_info_score',
    'products:idx_products_category',
    'products:idx_products_active_info_created',
    'reviews:idx_reviews_product',
    'comparisons:idx_comparisons_slug',
    'comparisons:idx_comparisons_published_missing_summary',
    'deals:deals_product_id_idx',
    'blog_posts:idx_blog_slug'
  ];
  missing_indexes jsonb := '[]'::jsonb;
  idx_check text;
  parts text[];
  hot jsonb;
  failures jsonb := '[]'::jsonb;
  enriched_failures jsonb := '[]'::jsonb;
  fail_elem jsonb;
  plan_text text;
  mean_threshold_ms numeric := 200;
  max_threshold_ms numeric := 800;
  has_pgss boolean;
BEGIN
  FOREACH idx_check IN ARRAY required_indexes LOOP
    parts := string_to_array(idx_check, ':');
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = parts[1] AND indexname = parts[2]
    ) THEN
      missing_indexes := missing_indexes || to_jsonb(idx_check);
    END IF;
  END LOOP;

  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') INTO has_pgss;

  IF has_pgss THEN
    SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
      INTO hot
    FROM (
      SELECT jsonb_build_object(
        'query', query,
        'query_preview', left(query, 160),
        'calls', calls,
        'mean_ms', round(mean_exec_time::numeric, 2),
        'max_ms', round(max_exec_time::numeric, 2),
        'total_ms', round(total_exec_time::numeric, 2),
        'over_mean', mean_exec_time > mean_threshold_ms,
        'over_max', max_exec_time > max_threshold_ms
      ) AS row
      FROM extensions.pg_stat_statements s
      JOIN pg_database d ON d.oid = s.dbid
      WHERE d.datname = current_database()
        AND query ILIKE '%public.%'
        AND query NOT ILIKE '%pg_stat_statements%'
        AND query NOT ILIKE '%db_perf_smoke%'
      ORDER BY total_exec_time DESC
      LIMIT 10
    ) t;

    FOR fail_elem IN SELECT elem FROM jsonb_array_elements(hot) elem
      WHERE (elem->>'over_mean')::boolean OR (elem->>'over_max')::boolean
    LOOP
      plan_text := NULL;
      BEGIN
        EXECUTE 'EXPLAIN (GENERIC_PLAN, BUFFERS, FORMAT TEXT) ' || (fail_elem->>'query')
          INTO plan_text;
      EXCEPTION WHEN OTHERS THEN
        plan_text := 'EXPLAIN failed: ' || SQLERRM;
      END;

      enriched_failures := enriched_failures || jsonb_build_array(
        fail_elem
          || jsonb_build_object('explain', COALESCE(plan_text, 'no plan'))
          - 'query'
      );
    END LOOP;
  ELSE
    hot := '[]'::jsonb;
  END IF;

  -- Drop the raw query text from the hot list now that breaches carry their own.
  SELECT COALESCE(jsonb_agg(elem - 'query'), '[]'::jsonb) INTO hot
  FROM jsonb_array_elements(hot) elem;

  RETURN jsonb_build_object(
    'checked_at', now(),
    'thresholds', jsonb_build_object('mean_ms', mean_threshold_ms, 'max_ms', max_threshold_ms),
    'missing_indexes', missing_indexes,
    'hot_queries', hot,
    'threshold_failures', enriched_failures,
    'pg_stat_statements', has_pgss,
    'pass', (jsonb_array_length(missing_indexes) = 0 AND jsonb_array_length(enriched_failures) = 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.db_perf_smoke() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.db_perf_smoke() TO service_role;
