<template>
  <page-header-wrapper
    class="home-page-root"
    :breadcrumb="{ props: { routes: [{ path: '/home', breadcrumbName: $t('menu.home') }] } }"
  >
    <a-row :gutter="24" type="flex">
      <!-- 左列：指标展示区 + 告警动态 -->
      <a-col
        class="main-col"
        :xl="16"
        :lg="24"
        :md="24"
        :sm="24"
        :xs="24"
      >
        <!-- 区域1：HOST 指标展示区（两行四列） -->
        <a-card
          title="HOST Metrics Overview"
          class="metric-card"
          style="margin-bottom: 24px"
          :loading="loading"
          :bordered="false"
          :body-style="{ padding: 0 }"
        >
          <a-row>
            <a-col :span="6" v-for="m in metrics" :key="m.title">
              <div class="metric-cell metric-link" @click="handleMetricClick(m)">
                <a-icon :type="m.icon" class="metric-icon" :style="{ color: m.color }" />
                <div class="metric-meta">
                  <div class="metric-value" :style="{ color: m.color }">{{ m.value }}</div>
                  <div class="metric-label">{{ m.title }}</div>
                </div>
              </div>
            </a-col>
          </a-row>
        </a-card>

        <!-- 区域2：告警动态 -->
        <a-card title="Alerts" class="alert-card" :bordered="false">
          <template slot="extra">
            <a-dropdown :trigger="['click']">
              <a class="alert-filter">
                {{ alertFilterLabel }} <a-icon type="down" />
              </a>
              <a-menu slot="overlay" :selected-keys="[alertFilter]" @click="onAlertFilter">
                <a-menu-item key="all">All</a-menu-item>
                <a-menu-item key="occupied">Occupied Timeout Alert</a-menu-item>
                <a-menu-item key="offline">Offline Timeout Alert</a-menu-item>
                <a-menu-item key="hardware">Hardware Update Timeout Alert</a-menu-item>
              </a-menu>
            </a-dropdown>
          </template>
          <a-list
            class="alert-list-scroll"
            :loading="alertLoading"
            @scroll.native="onAlertScroll"
          >
            <a-list-item :key="index" v-for="(item, index) in alertList">
              <a-list-item-meta>
                <a-avatar
                  slot="avatar"
                  size="small"
                  :icon="alertTypeMap[item.type].icon"
                  :style="{ backgroundColor: alertTypeMap[item.type].color }"
                />
                <div slot="title" class="alert-title">
                  <template v-if="item.type === 'occupied'">
                    <span class="hl-user">{{ item.usedBy }}</span> has occupied
                    <a class="host-link" @click="handleHostClick(item)">{{ item.hostName }}</a> since <span class="hl-time">{{ item.time }}</span>, cumulative occupancy: <span class="hl-dur">{{ item.occupyDur }}</span>
                  </template>
                  <template v-else-if="item.type === 'offline'">
                    <a class="host-link" @click="handleHostClick(item)">{{ item.hostName }}</a>
                    has been offline since <span class="hl-time">{{ item.time }}</span>, cumulative offline duration: <span class="hl-dur">{{ item.offlineDur }}</span>
                  </template>
                  <template v-else>
                    <a class="host-link" @click="handleHostClick(item)">{{ item.hostName }}</a>
                    last hardware info sync time: <span class="hl-time">{{ item.time }}</span>, not updated for <span class="hl-dur">{{ item.unsyncDur }}</span>
                  </template>
                </div>
                <div slot="description" class="alert-desc">
                  {{ item.time }}
                </div>
              </a-list-item-meta>
            </a-list-item>
            <!-- key 防止被 a-list loading 的内部占位 div（无 key）复用，避免 scoped 属性丢失导致样式失效 -->
            <div v-if="loadingMoreAlerts" key="alert-loading-more" class="loading-more">
              <a-spin size="small" />
              <span>Loading...</span>
            </div>
            <div v-else-if="!alertLoading && alertList.length && !alertHasMore" key="alert-loaded-all" class="loaded-all">
              All data loaded
            </div>
          </a-list>
        </a-card>
      </a-col>

      <!-- 右列：待审批动态 -->
      <a-col
        class="pending-col"
        :xl="8"
        :lg="24"
        :md="24"
        :sm="24"
        :xs="24"
      >
        <a-card title="Pending Approvals" :bordered="false">
          <template slot="extra">
            <a-dropdown :trigger="['click']">
              <a class="alert-filter">
                {{ pendingFilterLabel }} <a-icon type="down" />
              </a>
              <a-menu slot="overlay" :selected-keys="[pendingFilter]" @click="onPendingFilter">
                <a-menu-item key="all">All</a-menu-item>
                <a-menu-item key="hardware">Hardware Change</a-menu-item>
                <a-menu-item key="offline">Forced Offline</a-menu-item>
                <a-menu-item key="activation">Activation</a-menu-item>
              </a-menu>
            </a-dropdown>
          </template>
          <a-list
            class="list-scroll"
            :loading="pendingLoading"
            @scroll.native="onPendingScroll"
          >
            <a-list-item :key="index" v-for="(item, index) in pendingList">
              <a-list-item-meta>
                <a-avatar
                  slot="avatar"
                  size="small"
                  :icon="item.icon"
                  :style="{ backgroundColor: item.color }"
                />
                <div slot="title" class="alert-title">
                  <a class="host-link" @click="handlePendingClick(item)">{{ item.hostName }}</a>
                  triggered {{ item.kind }} pending approval
                </div>
                <div slot="description" class="alert-desc">
                  {{ item.time }}
                </div>
              </a-list-item-meta>
            </a-list-item>
            <div v-if="loadingMorePending" key="pending-loading-more" class="loading-more">
              <a-spin size="small" />
              <span>Loading...</span>
            </div>
            <div v-else-if="!pendingLoading && pendingList.length && !pendingHasMore" key="pending-loaded-all" class="loaded-all">
              All data loaded
            </div>
          </a-list>
        </a-card>
      </a-col>
    </a-row>
  </page-header-wrapper>
</template>

<script>
import moment from 'moment'
import { stats, alerts } from '@/api/home'

// 列表分页大小（接口默认 10，最大 100）
const PAGE_SIZE = 10

// 告警筛选 key → 接口 type 参数（hardware 对应接口的 hw_stale）
const alertFilterTypeMap = {
  all: 'all',
  occupied: 'occupied',
  offline: 'offline',
  hardware: 'hw_stale'
}

// 告警类型配置（图标 / 颜色 / 筛选文案）
const alertTypeMap = {
  occupied: { label: 'Occupied Timeout Alert', icon: 'clock-circle', color: '#fa541c' },
  offline: { label: 'Offline Timeout Alert', icon: 'disconnect', color: '#f5222d' },
  hardware: { label: 'Hardware Update Timeout Alert', icon: 'laptop', color: '#d48806' }
}

// 待审批类型配置（筛选 key / 文案）
const pendingKindMap = {
  hardware: 'Hardware Change',
  offline: 'Forced Offline',
  activation: 'Activation'
}

// 待审批 kind → 图标 / 颜色
const pendingKindStyleMap = {
  'Hardware Change': { icon: 'laptop', color: '#722ed1' },
  'Forced Offline': { icon: 'poweroff', color: '#fa541c' },
  'Activation': { icon: 'rocket', color: '#1890ff' },
  'Unknown': { icon: 'question-circle', color: '#8c8c8c' }
}

export default {
  name: 'Home',
  data () {
    return {
      loading: true,

      // 区域1：指标展示区（两行四列），key 对应 /host/stats 响应字段，link 为点击跳转的目标列表页及状态筛选
      metrics: [
        { key: 'total', title: 'Total Hosts', value: 0, icon: 'database', color: '#1890ff', link: { path: '/available-host/list', query: { status: '' } } },
        { key: 'idle', title: 'Idle Hosts', value: 0, icon: 'check-circle', color: '#52c41a', link: { path: '/available-host/list', query: { status: 'Free' } } },
        { key: 'occupied', title: 'Occupied Hosts', value: 0, icon: 'schedule', color: '#fa8c16', link: { path: '/available-host/list', query: { status: 'Occupied' } } },
        { key: 'offline', title: 'Offline Hosts', value: 0, icon: 'disconnect', color: '#ff4d4f', link: { path: '/available-host/list', query: { status: 'Offline' } } },
        { key: 'pending', title: 'Pending Hosts', value: 0, icon: 'audit', color: '#722ed1', link: { path: '/pending-host/list', query: { status: '' } } },
        { key: 'occupied_timeout', title: 'Occupied Timeout Alerts', value: 0, icon: 'clock-circle', color: '#fa541c', link: { path: '/available-host/list', query: { status: 'Occupied' } } },
        { key: 'offline_timeout', title: 'Offline Timeout Alerts', value: 0, icon: 'exclamation-circle', color: '#f5222d', link: { path: '/available-host/list', query: { status: 'Offline' } } },
        // 可用 HOST 无硬件更新对应状态，跳转后展示全部
        { key: 'hardware_timeout', title: 'Hardware Update Timeout Alerts', value: 0, icon: 'laptop', color: '#d48806', link: { path: '/available-host/list', query: { status: '' } } }
      ],

      // 告警类型配置
      alertTypeMap,

      // 待审批类型配置
      pendingKindMap,

      // 告警筛选（all / occupied / offline / hardware）
      alertFilter: 'all',

      // 待审批筛选（all / hardware / offline）
      pendingFilter: 'all',

      // 区域2：告警动态（服务端分页，触底加载下一页）
      alertList: [],
      alertPage: 1,
      alertTotal: 0,
      alertLoading: true,
      loadingMoreAlerts: false,

      // 右列：待审批动态（服务端分页，触底加载下一页）
      pendingList: [],
      pendingPage: 1,
      pendingTotal: 0,
      pendingLoading: true,
      loadingMorePending: false
    }
  },
  computed: {
    alertFilterLabel () {
      return this.alertTypeMap[this.alertFilter]
        ? this.alertTypeMap[this.alertFilter].label
        : 'All'
    },
    pendingFilterLabel () {
      return this.pendingKindMap[this.pendingFilter] || 'All'
    },
    // 告警列表是否还有下一页
    alertHasMore () {
      return this.alertList.length < this.alertTotal
    },
    // 待审批列表是否还有下一页
    pendingHasMore () {
      return this.pendingList.length < this.pendingTotal
    }
  },
  created () {
    this.fetchStats()
    this.refreshAlerts()
    this.refreshPending()
  },
  methods: {
    // 看板统计（§2.1）
    async fetchStats () {
      try {
        const data = (await stats()) || {}

        this.metrics = this.metrics.map(m => ({
          ...m,
          value: data[m.key] !== undefined && data[m.key] !== null ? data[m.key] : m.value
        }))
      } catch (e) {
        this.$message.error('加载 HOST 统计数据失败')
      } finally {
        this.loading = false
      }
    },
    // 告警列表（§2.2，type=all/occupied/offline/hw_stale）
    async fetchAlerts () {
      try {
        const data = (await alerts({
          type: alertFilterTypeMap[this.alertFilter] || 'all',
          page: this.alertPage,
          page_size: PAGE_SIZE
        })) || {}
        const rows = (data.list || []).map(item => this.mapAlertItem(item))
        this.alertList = this.alertPage === 1 ? rows : this.alertList.concat(rows)
        this.alertTotal = data.total || 0
        return true
      } catch (e) {
        // 加载更多失败时回退页码，便于下次触底重试
        if (this.alertPage > 1) {
          this.alertPage -= 1
        }
        this.$message.error('加载告警列表失败')
        return false
      }
    },
    // 待审批列表（§2.2，type=pending，kind 过滤）
    async fetchPending () {
      try {
        const data = (await alerts({
          type: 'pending',
          kind: this.pendingFilter === 'all' ? undefined : pendingKindMap[this.pendingFilter],
          page: this.pendingPage,
          page_size: 20
        })) || {}
        const rows = (data.list || []).map(item => this.mapPendingItem(item))
        this.pendingList = this.pendingPage === 1 ? rows : this.pendingList.concat(rows)
        this.pendingTotal = data.total || 0
        return true
      } catch (e) {
        // 加载更多失败时回退页码，便于下次触底重试
        if (this.pendingPage > 1) {
          this.pendingPage -= 1
        }
        this.$message.error('加载待审批列表失败')
        return false
      }
    },
    // 重置到第一页并重新拉取告警列表
    refreshAlerts () {
      this.alertPage = 1
      this.alertLoading = true
      return this.fetchAlerts().then(ok => {
        if (!ok) {
          this.alertList = []
          this.alertTotal = 0
        }
      }).finally(() => {
        this.alertLoading = false
      })
    },
    // 重置到第一页并重新拉取待审批列表
    refreshPending () {
      this.pendingPage = 1
      this.pendingLoading = true
      return this.fetchPending().then(ok => {
        if (!ok) {
          this.pendingList = []
          this.pendingTotal = 0
        }
      }).finally(() => {
        this.pendingLoading = false
      })
    },
    // 告警行映射：alert_type 归一化（hw_stale → hardware），duration_hours 格式化为 Xh YYm
    mapAlertItem (item) {
      const dur = this.formatDuration(item.duration_hours)
      return {
        type: item.alert_type === 'hw_stale' ? 'hardware' : item.alert_type,
        hostName: item.hostname,
        usedBy: item.used_by,
        time: this.formatTime(item.since),
        occupyDur: dur,
        offlineDur: dur,
        unsyncDur: dur
      }
    },
    // 待审批行映射：kind 附带图标 / 颜色
    mapPendingItem (item) {
      return {
        hostName: item.hostname,
        time: this.formatTime(item.since),
        kind: item.kind,
        ...(pendingKindStyleMap[item.kind] || pendingKindStyleMap['Unknown'])
      }
    },
    // ISO 时间 → YYYY-MM-DD HH:mm:ss
    formatTime (value) {
      return value ? moment(value).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    // 小时数（2 位小数）→ Xh YYm
    formatDuration (hours) {
      if (hours === null || hours === undefined) {
        return '-'
      }
      const totalMinutes = Math.round(Number(hours) * 60)
      const h = Math.floor(totalMinutes / 60)
      const m = totalMinutes % 60
      return `${h}h ${String(m).padStart(2, '0')}m`
    },
    onAlertFilter ({ key }) {
      if (this.alertFilter === key) {
        return
      }
      this.alertFilter = key
      this.refreshAlerts()
    },
    onPendingFilter ({ key }) {
      if (this.pendingFilter === key) {
        return
      }
      this.pendingFilter = key
      this.refreshPending()
    },
    // 告警列表触底加载下一页
    onAlertScroll (e) {
      const el = e.target
      if (!el || this.loadingMoreAlerts || !this.alertHasMore) {
        return
      }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
        this.alertPage += 1
        this.loadingMoreAlerts = true
        this.fetchAlerts().finally(() => {
          this.loadingMoreAlerts = false
        })
      }
    },
    // 待审批列表触底加载下一页
    onPendingScroll (e) {
      const el = e.target
      if (!el || this.loadingMorePending || !this.pendingHasMore) {
        return
      }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
        this.pendingPage += 1
        this.loadingMorePending = true
        this.fetchPending().finally(() => {
          this.loadingMorePending = false
        })
      }
    },
    // 点击指标卡跳转对应 Host 列表页，携带状态筛选参数
    handleMetricClick (m) {
      if (!m.link) {
        return
      }
      this.$router.push({ path: m.link.path, query: m.link.query })
    },
    // 点击告警中的 hostname，跳转对应 Host 详情页（携带 hostname 供详情页展示）
    handleHostClick (item) {
      this.$router.push({
        path: '/available-host/detail',
        query: {
          hostname: item.hostName
        }
      })
    },
    // 点击待审批动态中的 hostname，跳转 Pending HOST 详情页
    handlePendingClick (item) {
      this.$router.push({
        path: '/pending-host/detail',
        query: {
          hostname: item.hostName
        }
      })
    }
  }
}
</script>

<style lang="less" scoped>
.home-page-root{
  height: calc(100vh - 64px)!important;
  display: block !important;
  overflow-y: auto !important;
}


/* 左右两列等高（a-row 为 flex），底部对齐 */
.main-col,
.pending-col {
  display: flex;
  flex-direction: column;
}

/* 告警动态 / 待审批动态卡片撑满剩余高度 */
.alert-card {
  flex: 1;
}

.pending-col > .ant-card {
  flex: 1;
}

/* 指标展示区：两行四列，带分隔线 */
.metric-cell {
  display: flex;
  align-items: center;
  padding: 24px;

  .metric-icon {
    font-size: 28px;
    margin-right: 16px;
  }

  .metric-value {
    font-size: 24px;
    line-height: 32px;
    font-weight: 600;
  }

  .metric-label {
    color: rgba(0, 0, 0, 0.45);
    font-size: 14px;
    line-height: 22px;
  }
}

/* 指标卡可点击：hover 反馈 + 跳转对应列表页 */
.metric-link {
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: #f5f5f5;
  }
}

.metric-card {
  height: auto !important;
  /deep/ .ant-row > .ant-col:not(:nth-child(4n + 1)) .metric-cell {
    border-left: 1px solid #f0f0f0;
  }

  /deep/ .ant-row > .ant-col:nth-child(n + 5) .metric-cell {
    border-top: 1px solid #f0f0f0;
  }
}

/* 告警筛选触发器（主题色） */
.alert-filter {
  color: #1890ff;

  &:hover {
    color: #40a9ff;
  }
}

/* 动态标题行 */
.alert-title {
  color: rgba(0, 0, 0, 0.85);
}

.alert-desc {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

.alert-list-scroll{
  max-height: calc(100vh - 600px);
  overflow-y: auto;
}

/* 列表滚动容器：超过最大高度出现滚动条，触底加载下一页 */
.list-scroll {
  max-height: calc(100vh - 320px);
  overflow-y: auto;
}

/* 触底加载更多指示 */
.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0 16px;

  span {
    margin-left: 8px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }
}

/* 已加载全部数据提示 */
.loaded-all {
  text-align: center;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  padding: 8px 0 16px;
}

/* 动态内容高亮标记：使用人 / hostname / 时间均为蓝色，超时时长为红色 */
.hl-user {
  color: #1890ff;
  font-weight: 600;
}

.hl-time {
  color: #1890ff;
}

.hl-dur {
  color: #f5222d;
  font-weight: 600;
}

/* hostname 可点击链接 */
.host-link {
  color: #1890ff;
  font-weight: 500;

  &:hover {
    color: #40a9ff;
  }
}
</style>
