defmodule Manavault.Repo.Migrations.AddLocationToDecks do
  use Ecto.Migration

  def change do
    alter table(:decks) do
      add :location_id, references(:locations, on_delete: :nilify_all)
    end

    create index(:decks, [:location_id])
  end
end
