import { createRouter, createWebHistory } from "vue-router";
import { checkExpiry, token, user } from "./lib/session";
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/caixas/:cash(agape|hospitalaria)",
      component: () => import("./views/AuxiliaryCashView.vue"),
      meta: { title: "Caixas independentes" },
    },
    {
      path: "/admin",
      component: () => import("./views/AdminView.vue"),
      meta: { title: "Administração", admin: true },
    },
    {
      path: "/login",
      component: () => import("./views/LoginView.vue"),
      meta: { title: "Entrar" },
    },
    {
      path: "/",
      component: () => import("./views/HomeView.vue"),
      meta: { title: "Visão geral" },
    },
    {
      path: "/membros",
      component: () => import("./views/MembersView.vue"),
      meta: { title: "Membros" },
    },
    {
      path: "/membros/:id/periodos/:periodId",
      component: () => import("./views/MemberPeriodView.vue"),
      meta: { title: "Cobranças do período" },
    },
    {
      path: "/membros/:id",
      component: () => import("./views/MemberView.vue"),
      meta: { title: "Detalhes do membro" },
    },
    {
      path: "/despesas",
      component: () => import("./views/ExpensesView.vue"),
      meta: { title: "Despesas" },
    },
    {
      path: "/despesas/:id",
      component: () => import("./views/ExpenseView.vue"),
      meta: { title: "Detalhes da despesa" },
    },
    {
      path: "/periodos",
      component: () => import("./views/PeriodsView.vue"),
      meta: { title: "Períodos financeiros" },
    },
    {
      path: "/periodos/:id",
      component: () => import("./views/PeriodView.vue"),
      meta: { title: "Detalhes do período" },
    },
    {
      path: "/operacoes",
      component: () => import("./views/OperationsView.vue"),
      meta: { title: "Caixa" },
    },
    {
      path: "/operacoes/:id",
      component: () => import("./views/OperationView.vue"),
      meta: { title: "Detalhes da operação" },
    },
    {
      path: "/relatorios",
      component: () => import("./views/ReportsView.vue"),
      meta: { title: "Extratos e relatórios" },
    },
    {
      path: "/extrato",
      component: () => import("./views/StatementView.vue"),
      meta: { title: "Extrato da loja" },
    },
    {
      path: "/configuracoes",
      component: () => import("./views/SettingsView.vue"),
      meta: { title: "Configurações" },
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
router.beforeEach((to) => {
  checkExpiry();
  if (!token.value && to.path !== "/login") return "/login";
  if (to.meta.admin && !user.value?.is_admin) return "/";
  if (token.value && to.path === "/login")
    return user.value?.is_admin && !user.value.lodges.length ? "/admin" : "/";
  if (
    token.value &&
    user.value?.is_admin &&
    !user.value.lodges.length &&
    to.path === "/"
  )
    return "/admin";
});
router.afterEach((to) => {
  document.title = `${String(to.meta.title)} · Entre Colunas`;
});
