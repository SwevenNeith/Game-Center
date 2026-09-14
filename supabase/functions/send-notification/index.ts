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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('Body reçu :', JSON.stringify(body))

    const { type, title, body: msgBody, scheduledAt } = body

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')

    if (error) {
      console.error('Erreur récupération subscriptions :', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders
      })
    }

    console.log('Subscriptions trouvées :', subscriptions?.length ?? 0)

    if (type === 'manuel') {
      // Envoie immédiatement
      for (const row of subscriptions) {
        try {
          await webpush.sendNotification(
            row.subscription,
            JSON.stringify({ title, body: msgBody })
          )
          console.log('Notification envoyée avec succès')
        } catch (e) {
          console.error('Erreur envoi notification :', e)
        }
      }

    } else if (type === 'planifie') {
      // Stocke pour envoi différé par le cron
      const { error: insertError } = await supabase
        .from('scheduled_notifications')
        .insert({ title, body: msgBody, scheduled_at: scheduledAt })

      if (insertError) {
        console.error('Erreur insertion notification planifiée :', insertError)
      } else {
        console.log('Notification planifiée à :', scheduledAt)
      }

    } else if (type === 'cron') {
      // Vérifie les notifications à envoyer
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
        for (const row of subscriptions) {
          try {
            await webpush.sendNotification(
              row.subscription,
              JSON.stringify({ title: notif.title, body: notif.body })
            )
            console.log('Notification planifiée envoyée :', notif.id)
          } catch (e) {
            console.error('Erreur envoi notification planifiée :', e)
          }
        }

        // Marque comme envoyée
        await supabase
          .from('scheduled_notifications')
          .update({ sent: true })
          .eq('id', notif.id)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders
    })

  } catch (e) {
    console.error('Erreur globale :', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: corsHeaders
    })
  }
})