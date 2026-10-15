import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import StarterAveugleView from '../views/StarterAveugleView.vue'

const APP_NAME = 'Game Center'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
      meta: { title: 'Dashboard' },
    },
    {
      path: '/starter-aveugle',
      name: 'starter-aveugle',
      component: StarterAveugleView,
      meta: { title: 'Starter à l’aveugle' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.afterEach((to) => {
  const pageTitle = to.meta?.title
  document.title = pageTitle ? `${APP_NAME} — ${pageTitle}` : APP_NAME
})

export default router
