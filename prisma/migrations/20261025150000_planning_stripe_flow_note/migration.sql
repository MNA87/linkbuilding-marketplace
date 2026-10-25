-- Planning (25-10-2026): de betaalflow voor reguliere klanten is gebouwd en in
-- de Stripe-sandbox getest. Notitie bij "Stripe live zetten" zodat bij livegang
-- duidelijk is wat er al werkt en wat er nog moet.
UPDATE "LaunchItem"
SET "note" = concat_ws(E'\n\n', nullif("note", ''),
  E'Betaalflow gebouwd en in de sandbox getest: reguliere klant rekent direct af (iDEAL, kaart, Apple Pay, Link, PayPal); de Stripe-webhook zet betaalde orders op betaald en maakt de factuur. Bedragen netjes op 2 decimalen; kortingen zichtbaar bij Bevestigen en op de factuur.\nVoor livegang: zet de live-sleutels (sk_live/pk_live) in Railway, registreer de webhook in de live-omgeving en vul STRIPE_WEBHOOK_SECRET; test daar opnieuw.\nNog niet af: bankoverschrijving (geparkeerd tot livegang). Let op: PayPal werkt alleen zolang publisher-uitbetalingen uit staan (anders ziet Stripe het als Connect en valt PayPal weg).')
WHERE "list" = 'livegang' AND "title" = 'Stripe live zetten'
  AND coalesce("note", '') NOT LIKE '%Betaalflow gebouwd en in de sandbox getest%';
