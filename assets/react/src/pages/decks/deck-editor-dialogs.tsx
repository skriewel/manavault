import { useApolloClient, useMutation, useQuery } from "@apollo/client/react"
import { useNavigate } from "@tanstack/react-router"
import { Edit3, Plus } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { Button } from "../../components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog"
import { Input } from "../../components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SELECT_NONE_VALUE,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { Textarea } from "../../components/ui/textarea"
import { useToast } from "../../components/ui/toast"
import { refetchActiveQueries } from "../../lib/apollo"
import { present, titleize } from "../../lib/utils"
import { CollectionItemFormOptionsDocument } from "../collection/documents"
import type { DeckDetail, DeckKind, DeckSummary } from "./deck-types"
import { DECK_FORMATS, DECK_KINDS, DECK_STATUSES } from "./deck-types"
import {
  CreateDeckDocument,
  DeckPlayHistoryDocument,
  UpdateDeckDocument,
} from "./queries"

export function EditDeckDialog({
  deck,
  onOpenChange,
  open,
}: {
  deck: DeckSummary | DeckDetail | null
  onOpenChange: (open: boolean) => void
  open?: boolean
}) {
  const client = useApolloClient()
  const { showToast } = useToast()
  const isOpen = open ?? Boolean(deck)
  const [name, setName] = useState("")
  const [kind, setKind] = useState<DeckKind>("deck")
  const [format, setFormat] = useState<(typeof DECK_FORMATS)[number]>("commander")
  const [status, setStatus] = useState<(typeof DECK_STATUSES)[number]>("brewing")
  const [locationId, setLocationId] = useState("")
  const [playCount, setPlayCount] = useState("0")
  const [skipCount, setSkipCount] = useState("0")
  const [lastPlayedDate, setLastPlayedDate] = useState("")
  const [coverDeckCardId, setCoverDeckCardId] = useState<string | null>(null)
  const [primer, setPrimer] = useState("")
  const [error, setError] = useState<string | null>(null)
  const deckCards = deck && "deckCards" in deck ? deck.deckCards : null
  const inlineHistory = hasPlayHistory(deck) ? deck : null
  const historyQuery = useQuery(DeckPlayHistoryDocument, {
    variables: { id: deck?.id || "" },
    skip: !deck || !isOpen || Boolean(inlineHistory),
  })
  const locationOptionsQuery = useQuery(CollectionItemFormOptionsDocument, {
    skip: !isOpen,
    fetchPolicy: "cache-and-network",
  })
  const locationOptions =
    locationOptionsQuery.data?.locations?.edges
      ?.map((edge) => edge?.node)
      .filter(present)
      .filter((location) => location.kind !== "list") || []
  const history = inlineHistory || historyQuery.data?.deck
  const isHistoryReady = Boolean(history)

  useEffect(() => {
    if (!deck || !isOpen) return
    setName(deck.name)
    setKind(deckKindValue(deck.kind))
    setFormat(deckFormatValue(deck.format))
    setStatus(deckStatusValue(deck.status))
    setLocationId(deck.location?.id || "")
    setCoverDeckCardId(deck.coverDeckCardId)
    setPrimer(deck.primer || "")
    setError(null)
  }, [deck, isOpen])

  useEffect(() => {
    if (!history || !isOpen) return
    setPlayCount(String(history.playCount))
    setSkipCount(String(history.skipCount))
    setLastPlayedDate(dateInputValue(history.lastPlayedAt))
  }, [history, isOpen])

  useEffect(() => {
    if (historyQuery.error) setError(historyQuery.error.message)
  }, [historyQuery.error])

  const [updateDeckMutation, updateDeckResult] = useMutation(UpdateDeckDocument)
  const updateDeck = {
    ...updateDeckResult,
    isPending: updateDeckResult.loading,
    mutate: (history: { playCount: number; skipCount: number; lastPlayedAt: string | null }) => {
      if (!deck) {
        setError("Deck is required")
        return
      }

      void updateDeckMutation({
        variables: {
          id: deck.id,
          input: {
            name: name.trim(),
            kind,
            format: kind === "cube" ? "casual" : format,
            status,
            locationId: locationId || null,
            ...history,
            primer: primer.trim() || null,
            ...(deckCards ? { coverDeckCardId } : {}),
          },
        },
        onCompleted: () => {
          void refetchActiveQueries(client)
          showToast("Deck updated")
          setError(null)
          onOpenChange(false)
        },
        onError: (error) =>
          setError(error instanceof Error ? error.message : "Could not update deck"),
      })
    },
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Deck name is required")
      return
    }

    const parsedPlayCount = parseHistoryCount(playCount)
    const parsedSkipCount = parseHistoryCount(skipCount)

    if (parsedPlayCount == null || parsedSkipCount == null) {
      setError("Play and skip counts must be whole numbers of 0 or more")
      return
    }

    updateDeck.mutate({
      playCount: parsedPlayCount,
      skipCount: parsedSkipCount,
      lastPlayedAt: dateInputTimestamp(lastPlayedDate),
    })
  }

  function close() {
    if (updateDeck.isPending) return
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}>
      <DialogContent
        className="flex max-h-[calc(100dvh-3rem)] max-w-2xl flex-col"
        labelledBy="edit-deck-title"
      >
        <DialogHeader>
          <div>
            <DialogTitle id="edit-deck-title">{kind === "cube" ? "Edit cube" : "Edit deck"}</DialogTitle>
            <p className="mt-1 text-sm text-base-content/75">
              {kind === "cube"
                ? "Update cube details, cover art, and notes."
                : "Update deck details, historical play data, and its player guide."}
            </p>
          </div>
          <DialogClose className="h-11 w-11" onClose={close} />
        </DialogHeader>

        <form className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5" noValidate onSubmit={submit}>
          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-base-content/80">
              Name
            </span>
            <Input
              className="min-h-11"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={kind === "cube" ? "Cube name" : "Deck name"}
              autoFocus
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-base-content/80">
                Type
              </span>
              <Select value={kind} onValueChange={(value) => setKind(deckKindValue(value))}>
                <SelectTrigger className="min-h-11 bg-base-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECK_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {kind === "cube" ? "Cube" : "Deck"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            {kind === "deck" ? (
            <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-base-content/80">
                  Format
                </span>
                <Select value={format} onValueChange={(value) => setFormat(deckFormatValue(value))}>
                  <SelectTrigger className="min-h-11 bg-base-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DECK_FORMATS.map((format) => (
                      <SelectItem key={format} value={format}>
                        {titleize(format)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              ) : (
              <div className="rounded-box border border-base-300 bg-base-200/40 p-3 text-sm text-base-content/70">
                Cube cards reserve their physical collection copies until they are deallocated or removed.
              </div>
            )}

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-base-content/80">
                Status
              </span>
              <Select value={status} onValueChange={(value) => setStatus(deckStatusValue(value))}>
                <SelectTrigger className="min-h-11 bg-base-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {titleize(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block space-y-2 sm:col-span-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-base-content/80">
                Physical location
              </span>
              <Select
                value={locationId || SELECT_NONE_VALUE}
                onValueChange={(value) => setLocationId(value === SELECT_NONE_VALUE ? "" : value)}
              >
                <SelectTrigger className="min-h-11 bg-base-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="No deck box assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NONE_VALUE}>No physical location</SelectItem>
                  {locationOptions.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({titleize(location.kind)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="block text-sm text-base-content/65">
                Allocated physical cards are stored at this collection location.
              </span>
            </label>
          </div>

          {kind === "deck" ? (
          <fieldset
            aria-busy={!isHistoryReady}
            className="rounded-box border border-base-300 bg-base-200/40 p-4"
          >
            <legend className="px-1 text-sm font-black tracking-normal">
              Historical play data
            </legend>
            <p id="deck-play-history-help" className="mb-4 text-sm text-base-content/65">
              {isHistoryReady
                ? "Import existing totals. Plays lower future pick odds; skips raise them."
                : "Loading existing totals..."}
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-base-content/80">
                  Plays
                </span>
                <Input
                  aria-describedby="deck-play-history-help"
                  className="min-h-11 font-mono font-bold tabular-nums"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  disabled={!isHistoryReady || updateDeck.isPending}
                  value={playCount}
                  onChange={(event) => setPlayCount(event.target.value)}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-base-content/80">
                  Skips
                </span>
                <Input
                  aria-describedby="deck-play-history-help"
                  className="min-h-11 font-mono font-bold tabular-nums"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  disabled={!isHistoryReady || updateDeck.isPending}
                  value={skipCount}
                  onChange={(event) => setSkipCount(event.target.value)}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-base-content/80">
                  Last played
                </span>
                <Input
                  aria-describedby="deck-play-history-help"
                  className="min-h-11"
                  type="date"
                  disabled={!isHistoryReady || updateDeck.isPending}
                  value={lastPlayedDate}
                  onChange={(event) => setLastPlayedDate(event.target.value)}
                />
              </label>
            </div>
          </fieldset>
          ) : null}

          {deckCards ? (
            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-base-content/80">
                Cover card
              </span>
              <Select
                value={coverDeckCardId || SELECT_NONE_VALUE}
                onValueChange={(value) =>
                  setCoverDeckCardId(value === SELECT_NONE_VALUE ? null : value)
                }
              >
                <SelectTrigger
                  aria-label="Cover card"
                  className="min-h-11 bg-base-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NONE_VALUE}>{kind === "cube" ? "Automatic" : "Automatic (commander first)"}</SelectItem>
                  {deckCards.map((deckCard) => (
                    <SelectItem key={deckCard.id} value={deckCard.id}>
                      {deckCard.card?.name || "Unknown card"} ·{" "}
                      {titleize(deckCard.zone || "mainboard")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="block text-sm text-base-content/75">
                {kind === "cube"
                  ? "Choose any card in this cube to use as its cover."
                  : "Uses the commander by default. Choose any card in this deck to override it."}
              </span>
            </label>
          ) : null}

          <div className="space-y-2">
            <label
              htmlFor="deck-primer"
              className="block text-xs font-black uppercase tracking-[0.18em] text-base-content/80"
            >
              Primer
            </label>
            <Textarea
              id="deck-primer"
              aria-describedby="deck-primer-help"
              className="min-h-48 resize-y leading-6"
              maxLength={50_000}
              placeholder={
                "Explain the game plan, opening hands, key lines, and anything a player should know."
              }
              value={primer}
              onChange={(event) => setPrimer(event.target.value)}
            />
            <span id="deck-primer-help" className="block text-sm text-base-content/65">
              Optional. Markdown headings, lists, links, emphasis, and code are supported.
            </span>
          </div>

          {error ? (
            <p className="rounded-box border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-base-300 pt-4">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={close}
              disabled={updateDeck.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-h-11"
              disabled={!isHistoryReady || updateDeck.isPending}
            >
              <Edit3 className="h-4 w-4" />
              {updateDeck.isPending ? "Saving..." : kind === "cube" ? "Save cube" : "Save deck"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function deckKindValue(value: string): DeckKind {
  return value === "cube" ? "cube" : "deck"
}

export function deckFormatValue(value: string): (typeof DECK_FORMATS)[number] {
  return DECK_FORMATS.find((format) => format === value) || "commander"
}

export function deckStatusValue(value: string): (typeof DECK_STATUSES)[number] {
  return DECK_STATUSES.find((status) => status === value) || "brewing"
}

function hasPlayHistory(deck: DeckSummary | DeckDetail | null): deck is DeckSummary {
  return Boolean(deck && "playCount" in deck)
}

function parseHistoryCount(value: string) {
  if (!/^\d+$/.test(value)) return null

  const count = Number(value)
  return Number.isSafeInteger(count) ? count : null
}

function dateInputValue(value: string | null) {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function dateInputTimestamp(value: string) {
  if (!value) return null

  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day).toISOString()
}

export function NewDeckDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const navigate = useNavigate()
  const client = useApolloClient()
  const { showToast } = useToast()
  const [name, setName] = useState("")
  const [kind, setKind] = useState<DeckKind>("deck")
  const [format, setFormat] = useState<(typeof DECK_FORMATS)[number]>("commander")
  const [status, setStatus] = useState<(typeof DECK_STATUSES)[number]>("brewing")
  const [locationId, setLocationId] = useState("")
  const [error, setError] = useState<string | null>(null)

  const locationOptionsQuery = useQuery(CollectionItemFormOptionsDocument, {
    skip: !open,
    fetchPolicy: "cache-and-network",
  })
  const locationOptions =
    locationOptionsQuery.data?.locations?.edges
      ?.map((edge) => edge?.node)
      .filter(present)
      .filter((location) => location.kind !== "list") || []

  const [createDeckMutation, createDeckResult] = useMutation(CreateDeckDocument)
  const createDeck = {
    ...createDeckResult,
    isPending: createDeckResult.loading,
    mutate: () =>
      void createDeckMutation({
        variables: {
          input: {
            name: name.trim(),
            kind,
            format: kind === "cube" ? "casual" : format,
            status,
            locationId: locationId || null,
          },
        },
        onCompleted: (data) => {
          void refetchActiveQueries(client)
          showToast(`Created ${kind === "cube" ? "cube" : "deck"} ${name.trim()}`)
          setName("")
          setKind("deck")
          setFormat("commander")
          setStatus("brewing")
          setLocationId("")
          setError(null)
          onOpenChange(false)

          if (data.createDeck?.deck?.id) {
            navigate({ to: "/decks/$id", params: { id: data.createDeck.deck.id } })
          }
        },
        onError: (error) =>
          setError(error instanceof Error ? error.message : "Could not create deck"),
      }),
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Deck name is required")
      return
    }

    createDeck.mutate()
  }

  function close() {
    if (createDeck.isPending) return
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-xl" labelledBy="new-deck-title">
        <DialogHeader>
          <div>
            <DialogTitle id="new-deck-title">New deck or cube</DialogTitle>
            <p className="mt-1 text-sm text-base-content/60">
              Create a decklist or a cube, then import or add cards from the catalog.
            </p>
          </div>
          <DialogClose onClose={close} />
        </DialogHeader>

        <form className="space-y-5 p-5" onSubmit={submit}>
          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-accent">Name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Deck name"
              autoFocus
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-accent">
                Type
              </span>
              <Select
                value={kind}
                onValueChange={(value) => {
                  const nextKind = deckKindValue(value)
                  setKind(nextKind)
                  if (nextKind === "cube" && status === "brewing") setStatus("active")
                }}
              >
                <SelectTrigger className="bg-base-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECK_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {kind === "cube" ? "Cube" : "Deck"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            {kind === "deck" ? (
            <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-accent">
                  Format
                </span>
                <Select
                  value={format}
                  onValueChange={(value) => setFormat(value as (typeof DECK_FORMATS)[number])}
                >
                  <SelectTrigger className="bg-base-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DECK_FORMATS.map((format) => (
                      <SelectItem key={format} value={format}>
                        {titleize(format)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              ) : (
              <div className="rounded-box border border-base-300 bg-base-200/40 p-3 text-sm text-base-content/70">
                A cube uses deck allocations so assigned cards are unavailable for normal pulls.
              </div>
            )}

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-accent">
                Status
              </span>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as (typeof DECK_STATUSES)[number])}
              >
                <SelectTrigger className="bg-base-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {titleize(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block space-y-2 sm:col-span-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-accent">
                Physical location
              </span>
              <Select
                value={locationId || SELECT_NONE_VALUE}
                onValueChange={(value) => setLocationId(value === SELECT_NONE_VALUE ? "" : value)}
              >
                <SelectTrigger className="bg-base-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="No deck box assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NONE_VALUE}>No physical location</SelectItem>
                  {locationOptions.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({titleize(location.kind)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="block text-sm text-base-content/65">
                Choose the deck box or other collection location where this deck or cube lives.
              </span>
            </label>
          </div>

          {error ? (
            <p className="rounded-box border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-base-300 pt-4">
            <Button type="button" variant="ghost" onClick={close} disabled={createDeck.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createDeck.isPending}>
              <Plus className="h-4 w-4" />
              {createDeck.isPending ? "Creating..." : kind === "cube" ? "Create cube" : "Create deck"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
