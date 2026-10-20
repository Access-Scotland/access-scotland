export const authorizeAdmin = async (getUser) => {
  const user = await getUser()

  if (!user) return { status: 401 }
  if (!Array.isArray(user.roles) || !user.roles.includes('admin')) {
    return { status: 403 }
  }

  return { status: 200, user }
}

export const handleAdminSession = async (request, getUser) => {
  const headers = {
    'Cache-Control': 'private, no-store',
    'Content-Type': 'application/json',
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...headers, Allow: 'GET' },
    })
  }

  const access = await authorizeAdmin(getUser)

  if (access.status !== 200) {
    return new Response(JSON.stringify({ error: 'Admin access required.' }), {
      status: access.status,
      headers,
    })
  }

  const { id, email, name } = access.user
  return new Response(JSON.stringify({ user: { id, email, name } }), {
    status: 200,
    headers,
  })
}
