defmodule Manavault.Catalog.PriceFragments do
  @moduledoc """
  Shared Ecto `fragment/1` macros for current collection-item prices.

  Vendor prices are stored as EUR cents. Scryfall pricing prefers native EUR
  fields and falls back to USD converted with the latest stored ECB USD/EUR
  reference rate.
  """

  alias Manavault.Catalog.Price

  coalesce_sql = fn keys ->
    "COALESCE(" <> Enum.map_join(keys, ", ", &"json_extract(?, '$.#{&1}')") <> ")"
  end

  vendor_order_sql = fn finishes ->
    cases =
      finishes
      |> Enum.with_index(1)
      |> Enum.map_join(" ", fn {finish, priority} ->
        "WHEN '#{finish}' THEN #{priority}"
      end)

    "CASE vendor_price.finish #{cases} ELSE #{length(finishes) + 1} END"
  end

  @foil_eur_keys Price.eur_fallback_keys("foil")
  @etched_eur_keys Price.eur_fallback_keys("etched")
  @default_eur_keys Price.eur_fallback_keys(nil)

  @foil_usd_keys Price.usd_fallback_keys("foil")
  @etched_usd_keys Price.usd_fallback_keys("etched")
  @default_usd_keys Price.usd_fallback_keys(nil)

  @foil_vendor_order vendor_order_sql.(Price.finish_fallbacks("foil"))
  @etched_vendor_order vendor_order_sql.(Price.finish_fallbacks("etched"))
  @default_vendor_order vendor_order_sql.(Price.finish_fallbacks(nil))

  @fx_rate_sql """
  SELECT pricing_setting.usd_per_eur
  FROM pricing_settings AS pricing_setting
  WHERE pricing_setting.id = 1
  """

  @vendor_price_sql """
  SELECT vendor_price.price_cents / 100.0
  FROM vendor_prices AS vendor_price
  WHERE vendor_price.vendor = (
    SELECT pricing_setting.source
    FROM pricing_settings AS pricing_setting
    WHERE pricing_setting.id = 1
  )
    AND vendor_price.scryfall_id = ?
    AND vendor_price.finish IN ('nonfoil', 'foil', 'etched')
  ORDER BY
    CASE ?
      WHEN 'foil' THEN #{@foil_vendor_order}
      WHEN 'etched' THEN #{@etched_vendor_order}
      ELSE #{@default_vendor_order}
    END
  LIMIT 1
  """

  @finish_case_sql """
  COALESCE(
    (#{@vendor_price_sql}),
    CAST(NULLIF(
      CASE ?
        WHEN 'foil' THEN #{coalesce_sql.(@foil_eur_keys)}
        WHEN 'etched' THEN #{coalesce_sql.(@etched_eur_keys)}
        ELSE #{coalesce_sql.(@default_eur_keys)}
      END,
      ''
    ) AS REAL),
    CAST(NULLIF(
      CASE ?
        WHEN 'foil' THEN #{coalesce_sql.(@foil_usd_keys)}
        WHEN 'etched' THEN #{coalesce_sql.(@etched_usd_keys)}
        ELSE #{coalesce_sql.(@default_usd_keys)}
      END,
      ''
    ) AS REAL) / NULLIF((#{@fx_rate_sql}), 0),
    0
  )
  """

  @finish_case_eur_prices_count length(@foil_eur_keys) + length(@etched_eur_keys) +
                                  length(@default_eur_keys)
  @finish_case_usd_prices_count length(@foil_usd_keys) + length(@etched_usd_keys) +
                                  length(@default_usd_keys)

  @default_price_sql """
  COALESCE(
    (
      SELECT vendor_price.price_cents / 100.0
      FROM vendor_prices AS vendor_price
      WHERE vendor_price.vendor = (
        SELECT pricing_setting.source
        FROM pricing_settings AS pricing_setting
        WHERE pricing_setting.id = 1
      )
        AND vendor_price.scryfall_id = ?
        AND vendor_price.finish IN ('nonfoil', 'foil', 'etched')
      ORDER BY #{@default_vendor_order}
      LIMIT 1
    ),
    CAST(NULLIF(
      #{coalesce_sql.(@default_eur_keys)},
      ''
    ) AS REAL),
    CAST(NULLIF(
      #{coalesce_sql.(@default_usd_keys)},
      ''
    ) AS REAL) / NULLIF((#{@fx_rate_sql}), 0),
    0
  )
  """

  @default_eur_prices_count length(@default_eur_keys)
  @default_usd_prices_count length(@default_usd_keys)

  @doc "Finish-aware current EUR price (as REAL) for an item's printing."
  defmacro price_value_fragment(item, printing) do
    eur_prices =
      List.duplicate(quote(do: unquote(printing).prices), @finish_case_eur_prices_count)

    usd_prices =
      List.duplicate(quote(do: unquote(printing).prices), @finish_case_usd_prices_count)

    quote do
      fragment(
        "CASE WHEN ? THEN 0 ELSE ? END",
        unquote(item).is_proxy,
        fragment(
          unquote(@finish_case_sql),
          unquote(printing).scryfall_id,
          unquote(item).finish,
          unquote(item).finish,
          unquote_splicing(eur_prices),
          unquote(item).finish,
          unquote_splicing(usd_prices)
        )
      )
    end
  end

  @doc "Finish-aware price in integer EUR cents."
  defmacro price_cents_fragment(item, printing) do
    quote do
      fragment(
        "CAST(round(? * 100) AS INTEGER)",
        price_value_fragment(unquote(item), unquote(printing))
      )
    end
  end

  @doc "Current price minus purchase basis in integer EUR cents."
  defmacro value_gain_cents_fragment(item, printing) do
    quote do
      fragment(
        "CASE WHEN ? THEN 0 ELSE ? - COALESCE(?, ?) END",
        unquote(item).is_proxy,
        price_cents_fragment(unquote(item), unquote(printing)),
        unquote(item).purchase_price_cents,
        price_cents_fragment(unquote(item), unquote(printing))
      )
    end
  end

  @doc "SUM of quantity * current EUR price cents across grouped rows."
  defmacro current_total_cents_fragment(item, printing) do
    quote do
      fragment(
        "COALESCE(SUM(? * COALESCE(?, 0)), 0)",
        unquote(item).quantity,
        price_cents_fragment(unquote(item), unquote(printing))
      )
    end
  end

  @doc "SUM of quantity * purchase price cents, falling back to current price."
  defmacro purchase_total_cents_fragment(item, printing) do
    quote do
      fragment(
        "COALESCE(SUM(? * CASE WHEN ? THEN 0 ELSE COALESCE(?, ?, 0) END), 0)",
        unquote(item).quantity,
        unquote(item).is_proxy,
        unquote(item).purchase_price_cents,
        price_cents_fragment(unquote(item), unquote(printing))
      )
    end
  end

  @doc "Finish-agnostic EUR price (as REAL), in the default fallback order."
  defmacro price_fragment(printing) do
    eur_prices =
      List.duplicate(quote(do: unquote(printing).prices), @default_eur_prices_count)

    usd_prices =
      List.duplicate(quote(do: unquote(printing).prices), @default_usd_prices_count)

    quote do
      fragment(
        unquote(@default_price_sql),
        unquote(printing).scryfall_id,
        unquote_splicing(eur_prices),
        unquote_splicing(usd_prices)
      )
    end
  end
end
