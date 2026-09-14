import webpush from 'npm:web-push'
import { createClient } from 'npm:@supabase/supabase-js'

webpush.setVapidDetails(
  'mailto:myra.mcsm@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('Body reçu :', JSON.stringify(body))

    const { type, title, body: msgBody, scheduledAt, subscriptionIds } = body

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')

    if (error) {
      console.error('Erreur récupération subscriptions :', error)
      return jsonResponse({ error: error.message }, 500)
    }

    const requestedIds = Array.isArray(subscriptionIds)
      ? subscriptionIds.map((id) => String(id))
      : []

    const targets = (subscriptions ?? []).filter((row) => {
      if (!requestedIds.length) return true
      return requestedIds.includes(String(row.id))
    })

    console.log('Subscriptions trouvées :', targets.length)

    let sent = 0
    let failed = 0

    if (type === 'manuel') {
      for (const row of targets) {
        try {
          await webpush.sendNotification(
            row.subscription,
            JSON.stringify({ title, body: msgBody })
          )
          sent += 1
          console.log('Notification envoyée avec succès')
        } catch (e) {
          failed += 1
          console.error('Erreur envoi notification :', e)
        }
      }
    } else if (type === 'planifie') {
      const { error: insertError } = await supabase
        .from('scheduled_notifications')
        .insert({ title, body: msgBody, scheduled_at: scheduledAt })

      if (insertError) {
        console.error('Erreur insertion notification planifiée :', insertError)
      } else {
        console.log('Notification planifiée à :', scheduledAt)
      }
    } else if (type === 'cron') {
      const maintenant = new Date().toISOString()
      console.log('Cron exécuté à :', maintenant)

      const { data: notificationsAEnvoyer, error: fetchError } = await supabase
        .from('scheduled_notifications')
        .select('*')
        .lte('scheduled_at', maintenant)
        .eq('sent', false)

      if (fetchError) {
        console.error('Erreur récupération notifications planifiées :', fetchError)
      } else {
        console.log('Notifications à envoyer :', notificationsAEnvoyer?.length ?? 0)
      }

      for (const notif of notificationsAEnvoyer ?? []) {
        for (const row of targets) {
          try {
            await webpush.sendNotification(
              row.subscription,
              JSON.stringify({ title: notif.title, body: notif.body })
            )
            sent += 1
            console.log('Notification planifiée envoyée :', notif.id)
          } catch (e) {
            failed += 1
            console.error('Erreur envoi notification planifiée :', e)
          }
        }

        await supabase
          .from('scheduled_notifications')
          .update({ sent: true })
          .eq('id', notif.id)
      }
    }

    return jsonResponse({ success: true, sent, failed })
  } catch (e) {
    console.error('Erreur globale :', e)
    return jsonResponse({ error: String(e) }, 500)
  }
})
