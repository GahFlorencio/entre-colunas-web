<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  LayoutDashboard,
  UsersRound,
  Receipt,
  CalendarRange,
  ArrowLeftRight,
  Settings2,
  LogOut,
  Download,
  Menu,
  X,
  Landmark,
  Sun,
  Moon,
  BookOpen,
  RefreshCw,
} from "@lucide/vue";
import { useRegisterSW } from "virtual:pwa-register/vue";
import {
  user,
  token,
  lodgeId,
  lodge,
  selectLodge,
  signOut,
} from "./lib/session";
import { pendingWrite, writeBusy, replayPending } from "./lib/financial-write";
import { message } from "./lib/format";
import { initials } from "./lib/format";
const route = useRoute(),
  router = useRouter(),
  menu = ref(false),
  online = ref(navigator.onLine);
const mobileMedia = matchMedia("(max-width: 760px)");
const isMobile = ref(mobileMedia.matches),
  closeButton = ref<HTMLButtonElement>(),
  menuButton = ref<HTMLButtonElement>();
function viewportChanged() {
  isMobile.value = mobileMedia.matches;
  if (!isMobile.value) menu.value = false;
}
watch(menu, async (opened) => {
  await nextTick();
  if (opened) closeButton.value?.focus();
  else if (isMobile.value) menuButton.value?.focus();
});
const dark = ref(
  localStorage.getItem("theme") === "dark" ||
    (!localStorage.getItem("theme") &&
      matchMedia("(prefers-color-scheme: dark)").matches),
);
function applyTheme() {
  document.documentElement.dataset.theme = dark.value ? "dark" : "light";
  localStorage.setItem("theme", dark.value ? "dark" : "light");
}
applyTheme();
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
const installEvent = ref<InstallEvent | null>(null),
  installHelp = ref(false);
const installed = ref(matchMedia("(display-mode: standalone)").matches);
function captureInstall(event: Event) {
  event.preventDefault();
  installEvent.value = event as InstallEvent;
}
async function install() {
  if (!installEvent.value) {
    installHelp.value = true;
    return;
  }
  await installEvent.value.prompt();
  await installEvent.value.userChoice;
  installEvent.value = null;
}
function installedHandler() {
  installed.value = true;
  installEvent.value = null;
}
function network() {
  online.value = navigator.onLine;
}
onMounted(() => {
  mobileMedia.addEventListener("change", viewportChanged);
  window.addEventListener("beforeinstallprompt", captureInstall);
  window.addEventListener("appinstalled", installedHandler);
  window.addEventListener("online", network);
  window.addEventListener("offline", network);
});
onUnmounted(() => {
  mobileMedia.removeEventListener("change", viewportChanged);
  window.removeEventListener("beforeinstallprompt", captureInstall);
  window.removeEventListener("appinstalled", installedHandler);
  window.removeEventListener("online", network);
  window.removeEventListener("offline", network);
});
const { needRefresh, updateServiceWorker } = useRegisterSW();
const nav = [
  { path: "/", title: "Visão geral", icon: LayoutDashboard },
  { path: "/membros", title: "Membros", icon: UsersRound },
  { path: "/despesas", title: "Despesas", icon: Receipt },
  { path: "/periodos", title: "Períodos", icon: CalendarRange },
  { path: "/operacoes", title: "Operações", icon: ArrowLeftRight },
  { path: "/extrato", title: "Extrato da loja", icon: BookOpen },
];
const pendingError = ref(""),
  pendingSuccess = ref("");
async function retryPending() {
  pendingError.value = "";
  pendingSuccess.value = "";
  try {
    await replayPending();
    pendingSuccess.value = "Lançamento confirmado. Os dados foram atualizados.";
  } catch (e) {
    pendingError.value = message(e);
  }
}
const contextKey = computed(() => `${user.value?.id}:${lodgeId.value}`);
function changeLodge(event: Event) {
  selectLodge((event.target as HTMLSelectElement).value);
  menu.value = false;
  void router.push("/");
}
</script>
<template>
  <a class="skip-link" href="#main">Ir para o conteúdo</a>
  <div v-if="!online" class="network-notice" role="status">
    Você está offline. Conecte-se para consultar e salvar informações.
  </div>
  <div v-if="needRefresh" class="update-notice" role="status">
    Uma nova versão está disponível. Salve seu trabalho antes de atualizar.
    <button @click="updateServiceWorker()">
      <RefreshCw aria-hidden="true" :size="16" /> Atualizar</button
    ><button class="secondary" @click="needRefresh = false">Depois</button>
  </div>
  <div v-if="token && user && route.path !== '/login'" class="app-shell">
    <button
      v-if="menu"
      class="scrim"
      aria-label="Fechar navegação"
      @click="menu = false"
    />
    <aside
      :inert="isMobile && !menu"
      @keydown.esc="menu = false"
      :class="['sidebar', { opened: menu }]"
    >
      <RouterLink to="/" class="brand" @click="menu = false"
        ><img src="/logo-dark.png" alt="" width="44" height="44" /><span
          >ENTRE COLUNAS<small>GESTÃO & FRATERNIDADE</small></span
        ></RouterLink
      >
      <button
        ref="closeButton"
        class="mobile-close icon-button"
        aria-label="Fechar menu"
        @click="menu = false"
      >
        <X aria-hidden="true" />
      </button>
      <p class="nav-label">ESPAÇO DA LOJA</p>
      <nav aria-label="Navegação principal">
        <RouterLink
          v-for="item in nav"
          :key="item.path"
          :to="item.path"
          :class="{
            active:
              item.path === '/'
                ? route.path === '/'
                : route.path.startsWith(item.path),
          }"
          @click="menu = false"
          ><component aria-hidden="true" :is="item.icon" :size="20" /><span>{{
            item.title
          }}</span></RouterLink
        >
      </nav>
      <div class="sidebar-bottom">
        <RouterLink v-if="user.is_admin" to="/admin" @click="menu = false"
          ><Settings2 aria-hidden="true" :size="20" /> Administração</RouterLink
        >
        <RouterLink to="/configuracoes" @click="menu = false"
          ><Settings2 aria-hidden="true" :size="20" /> Configurações</RouterLink
        ><button v-if="!installed" @click="install">
          <Download aria-hidden="true" :size="20" /> Instalar aplicativo
        </button>
        <div class="sidebar-note">
          <span class="small-gold">SIMPLES. ORGANIZADO. CONECTADO.</span>
          <p>Mais tempo para o que<br />nos une.</p>
        </div>
      </div>
    </aside>
    <div class="workspace" :inert="isMobile && menu">
      <header class="topbar">
        <button
          ref="menuButton"
          class="mobile-menu icon-button"
          aria-label="Abrir menu"
          :aria-expanded="menu"
          @click="menu = !menu"
        >
          <Menu aria-hidden="true" />
        </button>
        <div class="lodge-picker">
          <Landmark aria-hidden="true" :size="20" /><label
            ><span>LOJA ATIVA</span
            ><select
              aria-label="Loja ativa"
              :value="lodgeId"
              @change="changeLodge"
            >
              <option v-if="!user.lodges.length" value="">
                Nenhuma loja vinculada
              </option>
              <option v-for="l in user.lodges" :key="l.id" :value="l.id">
                {{ l.label }} · Nº {{ l.number }}
              </option>
            </select></label
          >
        </div>
        <div class="top-actions">
          <button
            class="icon-button"
            :aria-label="dark ? 'Ativar tema claro' : 'Ativar tema escuro'"
            @click="
              dark = !dark;
              applyTheme();
            "
          >
            <Sun aria-hidden="true" v-if="dark" :size="20" /><Moon
              aria-hidden="true"
              v-else
              :size="20"
            /></button
          ><span class="avatar">{{ initials(user.name) }}</span>
          <div class="user-name">
            <strong>{{ user.name }}</strong
            ><small>{{
              lodge?.masonic_authority.label || "Minha conta"
            }}</small>
          </div>
          <button
            class="icon-button"
            aria-label="Sair da conta"
            @click="signOut()"
          >
            <LogOut aria-hidden="true" :size="20" />
          </button>
        </div>
      </header>
      <main id="main" tabindex="-1">
        <div v-if="pendingWrite" class="notice" role="status">
          <strong>Um lançamento aguarda confirmação.</strong>
          <p>
            O resultado pode ter sido registrado pela API. Verifique antes de
            fazer outro lançamento.
          </p>
          <button class="secondary" :disabled="writeBusy" @click="retryPending">
            {{ writeBusy ? "Verificando…" : "Verificar lançamento pendente" }}
          </button>
          <p v-if="pendingError" class="alert" role="alert">
            {{ pendingError }}
          </p>
        </div>
        <p v-if="pendingSuccess" class="success-message" role="status">
          {{ pendingSuccess }}
        </p>
        <RouterView
          v-if="lodgeId || (user.is_admin && route.path === '/admin')"
          :key="contextKey + ':' + route.path"
        />
        <div v-else class="state">
          <h1>Nenhuma loja vinculada</h1>
          <p>Solicite ao administrador que vincule uma loja à sua conta.</p>
        </div>
        <footer class="page-footer">
          <span>Entre Colunas</span
          ><span>Organização que fortalece a união.</span>
        </footer>
      </main>
    </div>
  </div>
  <main v-else id="main"><RouterView /></main>
  <div v-if="installHelp" class="install-help" role="status">
    <strong>Instalar Entre Colunas</strong>
    <p>
      Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à
      tela inicial”. No iPhone, use o botão Compartilhar no Safari.
    </p>
    <button class="secondary" @click="installHelp = false">Entendi</button>
  </div>
</template>
