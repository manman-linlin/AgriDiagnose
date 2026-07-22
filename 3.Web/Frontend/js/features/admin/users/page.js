import { ref, computed, onMounted } from 'vue';
import { adminUsersList, adminUsersUpdate } from '../../../api/index.js';
import { useUiStore } from '../../../stores/ui.js';
import PageHeader from '../../../shared/components/PageHeader.js';
import AppIcon from '../../../shared/components/AppIcon.js';
import AppLoading from '../../../shared/components/AppLoading.js';
import AppEmpty from '../../../shared/components/AppEmpty.js';

export default {
  name: 'AdminUsers',
  components: { PageHeader, AppIcon, AppLoading, AppEmpty },
  setup() {
    const ui = useUiStore();
    const users = ref([]);
    const loading = ref(true);
    const search = ref('');
    const sortKey = ref('created_at');
    const sortDir = ref(-1);

    function toggleSort(key) {
      if (sortKey.value === key) { sortDir.value *= -1; }
      else { sortKey.value = key; sortDir.value = -1; }
    }

    const sortedUsers = computed(() => {
      const k = sortKey.value, d = sortDir.value;
      return [...users.value].sort((a, b) => {
        if (k === 'created_at') return d * (a.created_at || '').localeCompare(b.created_at || '');
        if (k === 'diagnosis') return d * ((a.stats?.diagnosis_count || 0) - (b.stats?.diagnosis_count || 0));
        if (k === 'contribution') return d * ((a.stats?.contribution_count || 0) - (b.stats?.contribution_count || 0));
        if (k === 'username') return d * (a.username || '').localeCompare(b.username || '');
        return 0;
      });
    });

    async function load() {
      loading.value = true;
      try { users.value = await adminUsersList(search.value ? { q: search.value } : {}); }
      catch { users.value = []; }
      finally { loading.value = false; }
    }

    async function changeRole(id, role) {
      try { await adminUsersUpdate(id, { role }); ui.showToast('角色已更新', 'success'); load(); }
      catch { ui.showToast('更新失败', 'error'); }
    }

    onMounted(load);

    return { users, loading, search, sortKey, sortDir, toggleSort, sortedUsers, load, changeRole };
  },
  template: `
    <div>
      <page-header icon="users" title="用户管理" description="注册用户列表与角色管理"></page-header>

      <div class="encyclopedia-toolbar" style="margin-bottom:16px;">
        <div class="search-box"><span class="search-icon">🔍</span><input v-model="search" @keyup.enter="load" placeholder="搜索用户名..." style="width:100%;height:44px;padding:0 14px 0 38px;border:1px solid var(--color-border);border-radius:8px;font-size:14px;" /></div>
        <button class="btn btn-sm btn-outline" @click="load">搜索</button>
      </div>

      <app-loading v-if="loading" text="加载用户列表..."></app-loading>
      <app-empty v-if="!loading && !users.length" icon="👤" title="暂无用户"></app-empty>

      <div v-if="!loading && users.length" class="card" style="padding:0;overflow:hidden;">
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr>
              <th @click="toggleSort('username')" style="cursor:pointer;user-select:none;">用户名 {{ sortKey==='username' ? (sortDir===1 ? '▲' : '▼') : '' }}</th>
              <th>显示名</th><th>角色</th>
              <th @click="toggleSort('diagnosis')" style="cursor:pointer;user-select:none;">诊断次数 {{ sortKey==='diagnosis' ? (sortDir===1 ? '▲' : '▼') : '' }}</th>
              <th @click="toggleSort('contribution')" style="cursor:pointer;user-select:none;">贡献次数 {{ sortKey==='contribution' ? (sortDir===1 ? '▲' : '▼') : '' }}</th>
              <th @click="toggleSort('created_at')" style="cursor:pointer;user-select:none;">注册时间 {{ sortKey==='created_at' ? (sortDir===1 ? '▲' : '▼') : '' }}</th>
              <th>操作</th>
            </tr></thead>
            <tbody>
              <tr v-for="u in sortedUsers" :key="u.id">
                <td>{{ u.username }}</td>
                <td>{{ u.display_name || '-' }}</td>
                <td>
                  <select class="form-select" style="height:32px;font-size:12px;padding:0 8px;" :value="u.role" @change="changeRole(u.id, $event.target.value)">
                    <option value="user">用户</option>
                    <option value="admin">管理员</option>
                  </select>
                </td>
                <td>{{ u.stats?.diagnosis_count || 0 }}</td>
                <td>{{ u.stats?.contribution_count || 0 }}</td>
                <td class="td-time">{{ u.created_at || '-' }}</td>
                <td><button class="btn btn-sm btn-outline" @click="changeRole(u.id, u.role==='admin'?'user':'admin')">{{ u.role==='admin'?'降为用户':'升管理员' }}</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};
