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
        <a-card title="Alerts" class="alert-card" :loading="loading" :bordered="false">
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
          <a-list :loading="loading">
            <a-list-item :key="index" v-for="(item, index) in filteredAlerts">
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
        <a-card title="Pending Approvals" :loading="loading" :bordered="false">
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
          <a-list :loading="loading">
            <a-list-item :key="index" v-for="(item, index) in filteredPendingList">
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
          </a-list>
        </a-card>
      </a-col>
    </a-row>
  </page-header-wrapper>
</template>

<script>
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

export default {
  name: 'Home',
  data () {
    return {
      loading: true,

      // 区域1：指标展示区（两行四列），link 为点击跳转的目标列表页及状态筛选
      metrics: [
        { title: 'Total Hosts', value: 148, icon: 'database', color: '#1890ff', link: { path: '/available-host/list', query: { status: '' } } },
        { title: 'Idle Hosts', value: 62, icon: 'check-circle', color: '#52c41a', link: { path: '/available-host/list', query: { status: 'Free' } } },
        { title: 'Occupied Hosts', value: 45, icon: 'schedule', color: '#fa8c16', link: { path: '/available-host/list', query: { status: 'Occupied' } } },
        { title: 'Offline Hosts', value: 28, icon: 'disconnect', color: '#ff4d4f', link: { path: '/available-host/list', query: { status: 'Offline' } } },
        { title: 'Pending Hosts', value: 13, icon: 'audit', color: '#722ed1', link: { path: '/pending-host/list', query: { status: '' } } },
        { title: 'Occupied Timeout Alerts', value: 3, icon: 'clock-circle', color: '#fa541c', link: { path: '/available-host/list', query: { status: 'Occupied' } } },
        { title: 'Offline Timeout Alerts', value: 2, icon: 'exclamation-circle', color: '#f5222d', link: { path: '/available-host/list', query: { status: 'Offline' } } },
        // 可用 HOST 无硬件更新对应状态，跳转后展示全部
        { title: 'Hardware Update Timeout Alerts', value: 4, icon: 'laptop', color: '#d48806', link: { path: '/available-host/list', query: { status: '' } } }
      ],

      // 告警类型配置
      alertTypeMap,

      // 待审批类型配置
      pendingKindMap,

      // 告警筛选（all / occupied / offline / hardware）
      alertFilter: 'all',

      // 待审批筛选（all / hardware / offline）
      pendingFilter: 'all',

      // 区域2：告警动态（每种状态仅一条示例数据，time 为事件时间，同时用作时间副标题）
      alertList: [
        {
          type: 'occupied',
          hostName: 'spa440-dev01',
          usedBy: 'li.zhang@intel.com',
          time: '2026-08-27 10:00:00',
          occupyDur: '28h 05m'
        },
        {
          type: 'offline',
          hostName: 'spa330-edge02',
          time: '2026-08-26 22:10:00',
          offlineDur: '49h 20m'
        },
        {
          type: 'hardware',
          hostName: 'spa220-test',
          time: '2026-08-21 08:45:00',
          unsyncDur: '167h 05m'
        }
      ],

      // 右列：待审批动态（示例数据，time 为时间副标题）
      pendingList: [
        { hostName: 'spa300-run', time: '2026-08-28 10:12:00', kind: 'Hardware Change', icon: 'laptop', color: '#722ed1' },
        { hostName: 'spa110-scale', time: '2026-08-27 16:40:00', kind: 'Forced Offline', icon: 'poweroff', color: '#fa541c' },
        { hostName: 'spa220-mobl', time: '2026-08-27 09:05:00', kind: 'Hardware Change', icon: 'laptop', color: '#722ed1' },
        { hostName: 'spa550-new01', time: '2026-08-28 14:30:00', kind: 'Activation', icon: 'rocket', color: '#1890ff' }
      ]
    }
  },
  computed: {
    alertFilterLabel () {
      return this.alertTypeMap[this.alertFilter]
        ? this.alertTypeMap[this.alertFilter].label
        : 'All'
    },
    filteredAlerts () {
      if (this.alertFilter === 'all') {
        return this.alertList
      }
      return this.alertList.filter(item => item.type === this.alertFilter)
    },
    pendingFilterLabel () {
      return this.pendingKindMap[this.pendingFilter] || 'All'
    },
    filteredPendingList () {
      if (this.pendingFilter === 'all') {
        return this.pendingList
      }
      const kind = this.pendingKindMap[this.pendingFilter]
      return this.pendingList.filter(item => item.kind === kind)
    }
  },
  created () {
    setTimeout(() => {
      this.loading = false
    }, 600)
  },
  methods: {
    onAlertFilter ({ key }) {
      this.alertFilter = key
    },
    onPendingFilter ({ key }) {
      this.pendingFilter = key
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
