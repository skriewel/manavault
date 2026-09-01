defmodule Manavault.Pricing.Settings do
  @moduledoc false

  use Ecto.Schema

  import Ecto.Changeset

  @sources ~w(scryfall cardmarket tcgplayer cardkingdom manapool)

  @primary_key {:id, :integer, autogenerate: false}
  schema "pricing_settings" do
    field :source, :string, default: "scryfall"
    field :usd_per_eur, :float
    field :fx_rate_date, :date

    timestamps(type: :utc_datetime)
  end

  def sources, do: @sources

  def changeset(settings, attrs) do
    settings
    |> cast(attrs, [:source])
    |> validate_required([:source])
    |> validate_inclusion(:source, @sources)
  end

  def exchange_rate_changeset(settings, attrs) do
    settings
    |> cast(attrs, [:usd_per_eur, :fx_rate_date])
    |> validate_required([:usd_per_eur, :fx_rate_date])
    |> validate_number(:usd_per_eur, greater_than: 0)
  end
end
