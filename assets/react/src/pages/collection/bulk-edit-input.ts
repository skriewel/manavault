import type { CollectionItemUpdateInput } from "../../gql/graphql"
import type { CollectionFinishOption } from "./item-form-fields.ts"
import { collectionFinishValue, parseCurrencyInputCents } from "./form-helpers.ts"

export type BulkCollectionItemEditFields = {
  finish: CollectionFinishOption
  purchasePrice: string
  isProxy: boolean
  updateFinish: boolean
  updatePurchasePrice: boolean
  updateProxy: boolean
}

export type BulkCollectionItemEditInputResult =
  | { ok: true; input: CollectionItemUpdateInput }
  | { ok: false; error: string }

export function buildBulkCollectionItemUpdateInput(
  fields: BulkCollectionItemEditFields,
): BulkCollectionItemEditInputResult {
  if (!fields.updateFinish && !fields.updatePurchasePrice && !fields.updateProxy) {
    return { ok: false, error: "Choose at least one field to update" }
  }

  const input: CollectionItemUpdateInput = {}

  if (fields.updateFinish) input.finish = collectionFinishValue(fields.finish)
  if (fields.updateProxy) input.isProxy = fields.isProxy

  if (fields.updatePurchasePrice) {
    const purchasePriceCents = parseCurrencyInputCents(fields.purchasePrice)

    if (purchasePriceCents === undefined) {
      return { ok: false, error: "Purchase price must be a dollar amount" }
    }

    input.purchasePriceCents = purchasePriceCents
  }

  return { ok: true, input }
}
