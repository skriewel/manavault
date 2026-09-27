defmodule ManavaultWeb.Api.V1.StatsControllerTest do
  use ManavaultWeb.ConnCase
  use Manavault.CatalogTestFixtures

  alias Manavault.Auth.ApiKeys
  alias Manavault.Catalog
  alias Manavault.PublicShareRequestLimiter

  setup do
    previous_rate_limit = Application.get_env(:manavault, :public_share_rate_limit)
    PublicShareRequestLimiter.reset()

    on_exit(fn ->
      Application.put_env(:manavault, :public_share_rate_limit, previous_rate_limit)
      PublicShareRequestLimiter.reset()
    end)

    :ok
  end

  test "requires a personal API key", %{conn: conn} do
    assert %{"error" => %{"code" => "unauthorized"}} =
             conn |> get("/api/v1/stats") |> json_response(401)
  end

  test "returns compact collection statistics", %{conn: conn} do
    assert {:ok, _} = Catalog.import_cards([black_lotus()])
    assert {:ok, _deck} = Catalog.create_deck(%{"name" => "Dashboard", "format" => "modern"})
    assert {:ok, _api_key, token} = ApiKeys.create("Homepage")

    response =
      conn
      |> put_req_header("authorization", "Bearer #{token}")
      |> get("/api/v1/stats")
      |> json_response(200)

    assert response["collection_cards"] >= 0
    assert response["collection_printings"] >= 0
    assert response["decks"] == 1
    assert is_number(response["collection_value_eur"])
  end
end
