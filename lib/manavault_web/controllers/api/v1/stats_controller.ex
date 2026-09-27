defmodule ManavaultWeb.Api.V1.StatsController do
  use ManavaultWeb, :controller

  alias Manavault.Catalog

  def show(conn, _params) do
    value = Catalog.collection_value_summary()

    json(conn, %{
      collection_cards: Catalog.count_collection_items(),
      collection_printings: Catalog.count_collection_item_groups(),
      decks: Catalog.count_non_archived_decks(),
      collection_value_eur: Float.round(value.total_price_cents / 100, 2)
    })
  end
end
