// UX guard only. The real protection is requireUserSession() in the API route.
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()

  if (!loggedIn.value) {
    return navigateTo('/')
  }
})
