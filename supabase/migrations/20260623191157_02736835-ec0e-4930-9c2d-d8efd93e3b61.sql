CREATE OR REPLACE FUNCTION public.db_perf_smoke(_mean_ms numeric DEFAULT 200, _max_ms numeric DEFAULT 800, _queries jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  enriched_failures jsonb := '[]'::jsonb;
  fail_elem jsonb;
  plan_text text;
  plan_mode text;
  q text;
  has_pgss boolean;
  rule jsonb;
  matched_rule jsonb;
  eff_mean numeric;
  eff_max numeric;
  over_mean boolean;
  over_max boolean;
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
        'total_ms', round(total_exec_time::numeric, 2)
      ) AS row
      FROM extensions.pg_stat_statements s
      JOIN pg_database d ON d.oid = s.dbid
      WHERE d.datname = current_database()
        AND query ILIKE '%public.%'
        AND query NOT ILIKE '%pg_stat_statements%'
        AND query NOT ILIKE '%db_perf_smoke%'
        AND lower(btrim(query)) LIKE 'select%'
      ORDER BY total_exec_time DESC
      LIMIT 10
    ) t;

    FOR fail_elem IN SELECT elem FROM jsonb_array_elements(hot) elem
    LOOP
      q := fail_elem->>'query';
      eff_mean := _mean_ms;
      eff_max := _max_ms;
      matched_rule := NULL;

      IF jsonb_typeof(_queries) = 'array' THEN
        FOR rule IN SELECT r FROM jsonb_array_elements(_queries) r
        LOOP
          IF rule ? 'match' AND position(lower(rule->>'match') in lower(q)) > 0 THEN
            matched_rule := rule;
            IF rule ? 'mean_ms' AND jsonb_typeof(rule->'mean_ms') = 'number' THEN
              eff_mean := (rule->>'mean_ms')::numeric;
            END IF;
            IF rule ? 'max_ms' AND jsonb_typeof(rule->'max_ms') = 'number' THEN
              eff_max := (rule->>'max_ms')::numeric;
            END IF;
            EXIT;
          END IF;
        END LOOP;
      END IF;

      over_mean := (fail_elem->>'mean_ms')::numeric > eff_mean;
      over_max := (fail_elem->>'max_ms')::numeric > eff_max;

      IF NOT (over_mean OR over_max) THEN
        CONTINUE;
      END IF;

      plan_text := NULL;
      plan_mode := 'ANALYZE';
      BEGIN
        PERFORM set_config('statement_timeout', '2000', true);
        EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ' || q INTO plan_text;
      EXCEPTION WHEN OTHERS THEN
        plan_mode := 'GENERIC_PLAN (ANALYZE failed: ' || SQLERRM || ')';
        BEGIN
          EXECUTE 'EXPLAIN (GENERIC_PLAN, BUFFERS, FORMAT TEXT) ' || q INTO plan_text;
        EXCEPTION WHEN OTHERS THEN
          plan_text := 'EXPLAIN failed: ' || SQLERRM;
        END;
      END;

      enriched_failures := enriched_failures || jsonb_build_array(
        (fail_elem - 'query')
          || jsonb_build_object(
            'explain_mode', plan_mode,
            'explain', COALESCE(plan_text, 'no plan'),
            'applied_mean_ms', eff_mean,
            'applied_max_ms', eff_max,
            'over_mean', over_mean,
            'over_max', over_max,
            'matched_rule', COALESCE(matched_rule, 'null'::jsonb)
          )
      );
    END LOOP;
  ELSE
    hot := '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(elem - 'query'), '[]'::jsonb) INTO hot
  FROM jsonb_array_elements(hot) elem;

  RETURN jsonb_build_object(
    'checked_at', now(),
    'thresholds', jsonb_build_object('mean_ms', _mean_ms, 'max_ms', _max_ms, 'queries', _queries),
    'missing_indexes', missing_indexes,
    'hot_queries', hot,
    'threshold_failures', enriched_failures,
    'pg_stat_statements', has_pgss,
    'pass', (jsonb_array_length(missing_indexes) = 0 AND jsonb_array_length(enriched_failures) = 0)
  );
END;
$function$;