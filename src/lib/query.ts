import { ref, shallowRef, watch, onScopeDispose } from "vue";
import { token, lodgeId } from "./session";
import { writeVersion } from "./financial-write";
import { message } from "./format";
export function useQuery<T>(
  fetcher: () => Promise<T>,
  dependencies: () => unknown = () => [],
) {
  const data = shallowRef<T | null>(null),
    error = ref(""),
    loading = ref(false);
  let generation = 0;
  async function refresh() {
    const current = ++generation;
    data.value = null;
    error.value = "";
    loading.value = true;
    try {
      const result = await fetcher();
      if (generation === current) data.value = result;
    } catch (e) {
      if (generation === current) error.value = message(e);
    } finally {
      if (generation === current) loading.value = false;
    }
  }
  watch(
    () => [token.value, lodgeId.value, writeVersion.value, dependencies()],
    () => {
      if (token.value && lodgeId.value) void refresh();
      else {
        generation++;
        data.value = null;
        error.value = "";
        loading.value = false;
      }
    },
    { immediate: true, deep: true },
  );
  onScopeDispose(() => {
    generation++;
  });
  return { data, error, loading, refresh };
}
