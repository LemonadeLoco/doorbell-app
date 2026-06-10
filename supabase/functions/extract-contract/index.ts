import Anthropic from "npm:@anthropic-ai/sdk@^0.27.0"

const client = new Anthropic() // uses ANTHROPIC_API_KEY from Supabase secrets

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pdfBase64 } = await req.json()

    if (!pdfBase64) {
      return new Response(JSON.stringify({ success: false, error: 'missing_pdf' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          {
            type: 'text',
            text: `This is a "Verbindliche Bestellung" (sales contract). Extract the customer data and return ONLY valid JSON, no other text, no markdown:
{
  "nachname": "customer last name from Name/Besteller field",
  "vorname": "customer first name from Vorname field",
  "strasse": "street + house number from Straße field",
  "plz": "postal code from PLZ/Ort field",
  "ort": "city from PLZ/Ort field",
  "telefon": "phone from Telefon des Kunden/privat field",
  "produkt": "one of: Haustür, Fenster, Rollläden, Markise, Terrassendach, Garagentor, Vordach, Dachfensterrollladen, Zip-Screen, Sonstiges",
  "vereinbarter_preis": 0,
  "datum": "YYYY-MM-DD from Datum field",
  "auftragsnummer": "the LA... order number"
}
For produkt: Markisentyp = Markise, Kunststofffenster/Fenster = Fenster, Haustür = Haustür, DFR/Dachfensterrollladen = Dachfensterrollladen, Rollladen = Rollläden.
For vereinbarter_preis: use the "vereinbarter Preis €" field (agreed/negotiated price, NOT Gesamtpreis).
Return only the JSON object, nothing else.`,
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    // Strip any accidental markdown code fences
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    try {
      const data = JSON.parse(cleaned)
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'parse_failed', raw: text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
