defmodule Manavault.Repo.Migrations.AddIsProxyToCollectionItems do
  use Ecto.Migration

  def change do
    alter table(:collection_items) do
      add :is_proxy, :boolean, null: false, default: false
    end
  end
end
