import { createRouter, createWebHistory } from "vue-router";

import * as store from "./store";

import CreatePage from "./views/CreatePage.vue";
import HomePage from "./views/HomePage.vue";
import LaunchPage from "./views/LaunchPage.vue";
import PayPage from "./views/PayPage.vue";

const routes = [
  {
    name: "create",
    path: "/create",
    component: CreatePage,
    meta: { title: "Create" },
  },
  {
    name: "home",
    path: "/",
    component: HomePage,
    meta: { title: "Konduit" },
  },
  {
    name: "launch",
    path: "/launch",
    component: LaunchPage,
    meta: { title: "Launch" },
  },
  {
    name: "pay",
    path: "/pay",
    component: PayPage,
    meta: { title: "Pay" },
  },
  {
    name: "settings",
    path: "/settings",
    component: () => import("./views/SettingsPage.vue"),
    meta: { title: "Settings" },
  },
];

const router = createRouter({
  history: createWebHistory(
    // @ts-ignore
    import.meta.env.BASE_URL || "http://localhost:5173/",
  ),
  routes,
});

router.beforeEach(async (to, _from) => {
  await store.init();
  let launchRouteNames = ["launch", "create"];
  if (!store.hasSigningKey.value && !launchRouteNames.includes(to.name as string)) {
    return { name: "launch" }
  }
})

export default router;
