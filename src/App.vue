<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  LayoutDashboard,
  UsersRound,
  Receipt,
  CalendarRange,
  Settings2,
  LogOut,
  Download,
  Menu,
  X,
  Landmark,
  Sun,
  Moon,
  BookOpen,
  FileText,
  RefreshCw,
} from "@lucide/vue";
import CashRegisterIcon from "@/components/CashRegisterIcon.vue";
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
const mobileMedia = matchMedia("(max-width: 1023px)");
const isMobile = ref(mobileMedia.matches),
  closeButton = ref<HTMLButtonElement>(),
  menuButton = ref<HTMLButtonElement>(),
  sidebar = ref<HTMLElement>();
let menuOrigin: HTMLElement | null = null;
function trapMenuFocus(event: KeyboardEvent) {
  if (!isMobile.value || !menu.value || event.key !== "Tab") return;
  const controls = sidebar.value?.querySelectorAll<HTMLElement>(
    "a[href], button:not([disabled])",
  );
  if (!controls?.length) return;
  const first = controls[0],
    last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
watch(token, (value) => {
  if (!value) menu.value = false;
});
function viewportChanged() {
  isMobile.value = mobileMedia.matches;
  if (!isMobile.value) menu.value = false;
}
watch(menu, async (opened) => {
  if (opened) menuOrigin = document.activeElement as HTMLElement;
  document.body.classList.toggle("navigation-open", opened);
  await nextTick();
  if (opened) closeButton.value?.focus();
  else if (isMobile.value) (menuOrigin ?? menuButton.value)?.focus();
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
  document.body.classList.remove("navigation-open");
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
  { path: "/periodos", title: "Mensalidades e períodos", icon: CalendarRange },
  { path: "/operacoes", title: "Caixa", icon: CashRegisterIcon },
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
function logout() {
  menu.value = false;
  signOut();
}
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
      id="app-navigation"
      ref="sidebar"
      :role="isMobile && menu ? 'dialog' : undefined"
      :aria-modal="isMobile && menu ? true : undefined"
      aria-label="Menu principal"
      @keydown="trapMenuFocus"
      :inert="isMobile && !menu"
      @keydown.esc="menu = false"
      :class="['sidebar', { opened: menu }]"
    >
      <RouterLink to="/" class="brand" @click="menu = false"
        ><img src="/logo-dark.png" alt="" width="44" height="44" /><span
          >Entre Colunas<small>Gestão da loja</small></span
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
      <p class="nav-label">Navegação</p>
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
          :aria-current="
            (
              item.path === '/'
                ? route.path === '/'
                : route.path.startsWith(item.path)
            )
              ? 'page'
              : undefined
          "
          @click="menu = false"
          ><component aria-hidden="true" :is="item.icon" :size="20" /><span>{{
            item.title
          }}</span></RouterLink
        >
      </nav>
      <div class="sidebar-bottom">
        <button v-if="isMobile" aria-label="Sair da conta" @click="logout">
          <LogOut aria-hidden="true" :size="20" /> Sair da conta
        </button>
        <RouterLink v-if="user.is_admin" to="/admin" @click="menu = false"
          ><Settings2 aria-hidden="true" :size="20" /> Administração</RouterLink
        >
        <RouterLink to="/relatorios" @click="menu = false"
          ><FileText aria-hidden="true" :size="20" /> Extratos e
          relatórios</RouterLink
        >
        <RouterLink to="/configuracoes" @click="menu = false"
          ><Settings2 aria-hidden="true" :size="20" /> Configurações</RouterLink
        ><button v-if="!installed" @click="install">
          <Download aria-hidden="true" :size="20" /> Instalar aplicativo
        </button>
      </div>
    </aside>
    <div class="workspace" :inert="isMobile && menu">
      <header class="topbar">
        <button
          ref="menuButton"
          class="mobile-menu icon-button"
          aria-label="Abrir menu"
          :aria-expanded="menu"
          aria-controls="app-navigation"
          @click="menu = !menu"
        >
          <Menu aria-hidden="true" />
        </button>
        <div class="lodge-picker">
          <Landmark aria-hidden="true" :size="20" /><label
            ><span>Loja ativa</span
            ><select
              aria-label="Loja ativa"
              :value="lodgeId"
              :title="lodge ? `${lodge.label} · Nº ${lodge.number}` : undefined"
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
            v-if="!isMobile"
            class="icon-button"
            aria-label="Sair da conta"
            @click="logout"
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
          :key="
            contextKey + ':' + route.path + ':' + JSON.stringify(route.params)
          "
        />
        <div v-else class="state">
          <h1>Nenhuma loja vinculada</h1>
          <p>Solicite ao administrador que vincule uma loja à sua conta.</p>
        </div>
        <footer class="page-footer">
          <span>Entre Colunas</span><span>Gestão da loja</span>
        </footer>
      </main>
      <nav v-if="isMobile" class="mobile-nav" aria-label="Navegação rápida">
        <RouterLink
          v-for="item in nav.filter((item) =>
            ['/', '/membros', '/periodos', '/operacoes'].includes(item.path),
          )"
          :key="item.path"
          :to="item.path"
          :class="{
            active:
              item.path === '/'
                ? route.path === '/'
                : route.path.startsWith(item.path),
          }"
          :aria-current="
            (
              item.path === '/'
                ? route.path === '/'
                : route.path.startsWith(item.path)
            )
              ? 'page'
              : undefined
          "
        >
          <component :is="item.icon" :size="20" aria-hidden="true" />
          <span>{{
            item.path === "/"
              ? "Início"
              : item.path === "/periodos"
                ? "Mensais"
                : item.title
          }}</span>
        </RouterLink>
        <button
          :class="{
            active: [
              '/despesas',
              '/extrato',
              '/configuracoes',
              '/admin',
              '/relatorios',
            ].some((path) => route.path.startsWith(path)),
          }"
          aria-label="Mais opções"
          aria-controls="app-navigation"
          :aria-expanded="menu"
          @click="menu = true"
        >
          <Menu :size="20" aria-hidden="true" /><span>Mais</span>
        </button>
      </nav>
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
