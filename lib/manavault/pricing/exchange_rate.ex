defmodule Manavault.Pricing.ExchangeRate do
  @moduledoc """
  Fetches the ECB's latest EUR reference rate for USD.

  The ECB publishes rates as units of foreign currency per EUR, so a value of
  1.10 means 1 EUR = 1.10 USD.
  """

  @url "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"

  def fetch(req_options \\ []) do
    options =
      Keyword.merge(
        [url: @url, receive_timeout: :timer.seconds(30)],
        req_options
      )

    case Req.get(options) do
      {:ok, %Req.Response{status: 200, body: body}} ->
        parse(body)

      {:ok, %Req.Response{status: status}} ->
        {:error, "ECB returned HTTP #{status}"}

      {:error, exception} ->
        {:error, Exception.message(exception)}
    end
  end

  def parse(body) when is_binary(body) do
    with [_, date] <- Regex.run(~r/time=['"](\d{4}-\d{2}-\d{2})['"]/, body),
         [_, rate] <- Regex.run(~r/currency=['"]USD['"]\s+rate=['"]([0-9.]+)['"]/, body),
         {:ok, parsed_date} <- Date.from_iso8601(date),
         {usd_per_eur, ""} <- Float.parse(rate),
         true <- usd_per_eur > 0 do
      {:ok, %{usd_per_eur: usd_per_eur, date: parsed_date}}
    else
      _invalid -> {:error, "ECB response did not contain a valid USD reference rate"}
    end
  end

  def parse(_body), do: {:error, "ECB returned an unexpected response"}
end
