import { createApp, watch } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { restoreSession, token } from "./lib/session";
import "./style.css";
async function start() {
  await restoreSession();
  const app = createApp(App).use(router);
  await router.isReady();
  app.mount("#app");
  watch(token, (value) => {
    if (!value) void router.replace("/login");
  });
}
void start();
