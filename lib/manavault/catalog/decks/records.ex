defmodule Manavault.Catalog.Decks.Records do
  @moduledoc false

  alias Manavault.Catalog.{Collection, Deck, DeckCard, Location}
  alias Manavault.Catalog.Decks.{Cards, DefaultTags, Preloads, Queries, ShareToken}
  alias Manavault.Repo

  @reserving_deck_statuses ["active"]
  @share_token_attempts 5

  def change_deck(%Deck{} = deck, attrs \\ %{}) do
    Deck.changeset(deck, attrs)
  end

  def create_deck(attrs) when is_map(attrs) do
    changeset =
      %Deck{}
      |> Deck.changeset(attrs)
      |> validate_deck_location()

    Repo.transact(fn ->
      case Repo.insert(changeset) do
        {:ok, deck} ->
          case DefaultTags.seed_deck_default_tags(deck) do
            {:ok, _deck_tags} -> {:ok, deck}
            {:error, reason} -> Repo.rollback(reason)
          end

        {:error, changeset} ->
          Repo.rollback(changeset)
      end
    end)
  end

  def update_deck(%Deck{} = deck, attrs) when is_map(attrs) do
    changeset =
      deck
      |> Deck.changeset(attrs)
      |> validate_deck_location()

    location_changed? = match?({:ok, _location_id}, Ecto.Changeset.fetch_change(changeset, :location_id))

    case valid_cover_deck_card?(changeset, deck.id) do
      true ->
        Repo.transact(fn ->
          case Repo.update(changeset) do
            {:ok, updated_deck} ->
              if location_changed? do
                move_allocated_cards_to_deck_location!(updated_deck)
              end

              {:ok, updated_deck}

            {:error, changeset} ->
              Repo.rollback(changeset)
          end
        end)

      false ->
        {:error, Ecto.Changeset.add_error(changeset, :cover_deck_card_id, "must belong to deck")}
    end
  end

  def save_deck_analysis(%Deck{} = deck, attrs) when is_map(attrs) do
    deck
    |> Deck.analysis_changeset(attrs)
    |> Repo.update()
  end

  def ensure_deck_share_token(%Deck{} = deck) do
    deck = Repo.get!(Deck, deck.id)

    case deck.share_token do
      token when is_binary(token) and token != "" ->
        {:ok, Repo.preload(deck, Preloads.deck_preloads())}

      _token ->
        put_deck_share_token(deck, @share_token_attempts)
    end
  end

  def disable_deck_sharing(%Deck{} = deck) do
    Deck
    |> Repo.get!(deck.id)
    |> Deck.disable_share_changeset()
    |> Repo.update()
  end

  def rotate_deck_share_token(%Deck{} = deck) do
    Deck
    |> Repo.get!(deck.id)
    |> put_deck_share_token(@share_token_attempts)
  end

  def delete_deck(%Deck{} = deck) do
    Repo.transact(fn ->
      deck =
        deck
        |> Repo.preload(deck_cards: [deck_allocations: [:collection_item]])

      Enum.each(deck.deck_cards, fn deck_card ->
        case Cards.delete_deck_card_for_deck_deletion(deck_card) do
          {:ok, _deck_card} -> :ok
          {:error, reason} -> Repo.rollback(reason)
        end
      end)

      case Repo.delete(deck) do
        {:ok, deck} -> {:ok, deck}
        {:error, changeset} -> {:error, changeset}
      end
    end)
  end

  def deck_reserves_cards?(%Deck{kind: "cube", status: status}), do: status != "archived"
  def deck_reserves_cards?(%Deck{status: status}), do: deck_reserves_cards?(status)
  def deck_reserves_cards?(status) when is_binary(status), do: status in @reserving_deck_statuses

  defp validate_deck_location(changeset) do
    case Ecto.Changeset.get_field(changeset, :location_id) do
      nil ->
        changeset

      location_id ->
        case Repo.get(Location, location_id) do
          %Location{kind: "list"} ->
            Ecto.Changeset.add_error(
              changeset,
              :location_id,
              "must be a physical collection location"
            )

          %Location{} ->
            changeset

          nil ->
            changeset
        end
    end
  end

  defp move_allocated_cards_to_deck_location!(%Deck{} = deck) do
    deck
    |> Repo.preload([deck_cards: [deck_allocations: [:collection_item]]], force: true)
    |> Map.fetch!(:deck_cards)
    |> Enum.flat_map(& &1.deck_allocations)
    |> Enum.map(& &1.collection_item)
    |> Enum.uniq_by(& &1.id)
    |> Enum.each(fn collection_item ->
      case Collection.update_collection_item(collection_item, %{"location_id" => deck.location_id}) do
        {:ok, _collection_item} -> :ok
        {:error, changeset} -> Repo.rollback(changeset)
      end
    end)
  end

  defp valid_cover_deck_card?(%Ecto.Changeset{valid?: false}, _deck_id), do: true

  defp valid_cover_deck_card?(changeset, deck_id) do
    case Ecto.Changeset.fetch_change(changeset, :cover_deck_card_id) do
      :error -> true
      {:ok, nil} -> true
      {:ok, id} -> match?(%DeckCard{deck_id: ^deck_id}, Repo.get(DeckCard, id))
    end
  end

  defp put_deck_share_token(_deck, 0), do: {:error, :share_token_collision}

  defp put_deck_share_token(%Deck{} = deck, attempts) do
    case deck |> Deck.share_changeset(new_share_token()) |> Repo.update() do
      {:ok, deck} ->
        {:ok, Repo.preload(deck, Preloads.deck_preloads())}

      {:error, changeset} ->
        if Keyword.has_key?(changeset.errors, :share_token) do
          deck
          |> Map.fetch!(:id)
          |> Queries.get_deck!()
          |> put_deck_share_token(attempts - 1)
        else
          {:error, changeset}
        end
    end
  end

  defp new_share_token, do: ShareToken.generate()
end
