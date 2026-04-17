import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Check if admin already exists
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
  const adminExists = existingUsers?.users?.some(u => u.email === 'admin@dualegenda.com')
  
  if (adminExists) {
    return new Response(JSON.stringify({ message: 'Admin already exists' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Create admin user
  const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
    email: 'admin@dualegenda.com',
    password: 'Admin123!',
    email_confirm: true,
    user_metadata: { full_name: 'Admin Dua Legenda' },
  })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }

  // Update role to management
  if (newUser.user) {
    await supabaseAdmin.from('user_roles')
      .update({ role: 'management' })
      .eq('user_id', newUser.user.id)
  }

  return new Response(JSON.stringify({ message: 'Admin created', userId: newUser.user?.id }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
