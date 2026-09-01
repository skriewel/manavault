defmodule Manavault.Pricing.Vendors.CardMarket do
  @moduledoc """
  Cardmarket's public Magic price guide.

  The guide is joined to Scryfall printings through Scryfall's `cardmarket_id`,
  which is Cardmarket's `idProduct`. Trend prices are used for collection
  valuation. Cardmarket publishes the guide in EUR.
  """

  import Ecto.Query

  alias Manavault.Catalog.Printing
  alias Manavault.Pricing.Money
  alias Manavault.Repo

  @price_guide_url "https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_1.json"

  def vendor, do: "cardmarket"
  def currency, do: :eur
  def sync_interval, do: :timer.hours(24)

  def fetch(req_options \\ []) do
    options =
      Keyword.merge(
        [url: @price_guide_url, receive_timeout: :timer.minutes(5)],
        req_options
      )

    case Req.get(options) do
      {:ok, %Req.Response{status: 200, body: body}} ->
        {:ok, rows(body, cardmarket_product_map())}

      {:ok, %Req.Response{status: status}} ->
        {:error, "Cardmarket returned HTTP #{status}"}

      {:error, exception} ->
        {:error, Exception.message(exception)}
    end
  end

  def rows(body, product_map) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, decoded} -> rows(decoded, product_map)
      {:error, _reason} -> []
    end
  end

  def rows(body, product_map) when is_map(body) do
    body
    |> guide_rows()
    |> rows(product_map)
  end

  def rows(guides, product_map) when is_list(guides) and is_map(product_map) do
    Enum.flat_map(guides, fn guide ->
      product_id = integer_value(guide["idProduct"] || guide["productId"] || guide["id"])

      case Map.get(product_map, product_id, []) do
        [] ->
          []

        scryfall_ids ->
          nonfoil = price_cents(guide, ["trend"])
          foil = price_cents(guide, ["trend-foil", "trend_foil", "trend-holo", "trend_holo"])

          Enum.flat_map(scryfall_ids, fn scryfall_id ->
            []
            |> maybe_price_row(scryfall_id, "nonfoil", nonfoil)
            |> maybe_price_row(scryfall_id, "foil", foil)
          end)
      end
    end)
  end

  def rows(_body, _product_map), do: []

  defp guide_rows(%{"priceGuides" => rows}) when is_list(rows), do: rows
  defp guide_rows(%{"priceGuide" => rows}) when is_list(rows), do: rows
  defp guide_rows(%{"prices" => rows}) when is_list(rows), do: rows
  defp guide_rows(%{"data" => rows}) when is_list(rows), do: rows
  defp guide_rows(_body), do: []

  defp cardmarket_product_map do
    Printing
    |> where([printing], not is_nil(printing.cardmarket_id))
    |> select([printing], {printing.cardmarket_id, printing.scryfall_id})
    |> Repo.all(timeout: :infinity)
    |> Enum.reduce(%{}, fn {product_id, scryfall_id}, acc ->
      Map.update(acc, product_id, [scryfall_id], &[scryfall_id | &1])
    end)
  end

  defp maybe_price_row(rows, _scryfall_id, _finish, nil), do: rows

  defp maybe_price_row(rows, scryfall_id, finish, price_cents) do
    [%{scryfall_id: scryfall_id, finish: finish, price_cents: price_cents} | rows]
  end

  defp price_cents(guide, keys) do
    Enum.find_value(keys, fn key -> Money.to_cents(guide[key]) end)
  end

  defp integer_value(value) when is_integer(value), do: value

  defp integer_value(value) when is_binary(value) do
    case Integer.parse(value) do
      {parsed, ""} -> parsed
      _invalid -> nil
    end
  end

  defp integer_value(_value), do: nil
end
