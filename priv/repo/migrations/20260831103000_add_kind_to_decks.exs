defmodule Manavault.Repo.Migrations.AddKindToDecks do
  use Ecto.Migration

  def change do
    alter table(:decks) do
      add :kind, :string, null: false, default: "deck"
    end

    create index(:decks, [:kind])
  end
end
