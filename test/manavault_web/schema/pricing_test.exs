defmodule ManavaultWeb.Schema.PricingTest do
  use ManavaultWeb.ConnCase
  use Oban.Testing, repo: Manavault.Repo, engine: Oban.Engines.Lite

  alias Manavault.Pricing
  alias Manavault.Pricing.{Settings, VendorSyncWorker}

  test "pricing settings expose EUR, Cardmarket, and ECB status", %{conn: conn} do
    assert {:ok, _settings} =
             Pricing.settings()
             |> Settings.exchange_rate_changeset(%{
               usd_per_eur: 1.1723,
               fx_rate_date: ~D[2026-09-01]
             })
             |> Repo.update()

    conn =
      post(conn, "/api/graphql", %{
        "query" => """
        query {
          pricingSettings {
            source
            sources
            currency
            usdPerEur
            fxRateDate
            fxSource
          }
        }
        """
      })

    assert %{
             "data" => %{
               "pricingSettings" => %{
                 "source" => "scryfall",
                 "sources" => sources,
                 "currency" => "EUR",
                 "usdPerEur" => 1.1723,
                 "fxRateDate" => "2026-09-01",
                 "fxSource" => "ECB"
               }
             }
           } = json_response(conn, 200)

    assert "cardmarket" in sources
  end

  test "vendor price sync mutation queues an Oban job", %{conn: conn} do
    conn =
      post(conn, "/api/graphql", %{
        "query" => """
        mutation {
          syncVendorPrices {
            pricingSettings { source }
          }
        }
        """
      })

    assert %{
             "data" => %{
               "syncVendorPrices" => %{
                 "pricingSettings" => %{"source" => _source}
               }
             }
           } = json_response(conn, 200)

    assert_enqueued(worker: VendorSyncWorker, args: %{force: true})
  end
end
