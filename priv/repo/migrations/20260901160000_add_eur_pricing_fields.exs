defmodule Manavault.Repo.Migrations.AddEurPricingFields do
  use Ecto.Migration

  def change do
    alter table(:scryfall_printings) do
      add :cardmarket_id, :integer
    end

    create index(:scryfall_printings, [:cardmarket_id])

    alter table(:pricing_settings) do
      add :usd_per_eur, :float
      add :fx_rate_date, :date
    end
  end
end
