<template>
  <!-- 页头标题：HOST ID（同 Host 详情页）；面包屑：Pending HOST（点击回列表）/ Pending HOST 详情（当前页） -->
  <page-header-wrapper
    class="pending-host-detail-tabs"
    :title="'HOST ID: ' + hostId"
    :breadcrumb="breadcrumb"
  >
    <!-- content（左：Identification Information）与 extraContent（右：Status）在同一 flex 行，实现左右布局 -->
    <template v-slot:content>
      <a-descriptions size="small" :column="3" class="host-meta">
        <a-descriptions-item label="Hostname">
          <span class="meta-value">{{ hostInfo.hostname }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="IP">
          <span class="meta-value">{{ hostInfo.ip }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="MAC">
          <span class="meta-value">{{ hostInfo.mac }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="MachineGuid">
          <span class="meta-value">{{ hostInfo.machineGuid }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="Port">
          <span class="meta-value">5900</span>
        </a-descriptions-item>
        <a-descriptions-item label="Password">
          <span class="meta-value">{{ passwordDisplay }}</span>
        </a-descriptions-item>
      </a-descriptions>
    </template>
    <!-- actions：页头右上角操作区（同 Host 详情页 extra 布局）；Approve Enable 仅非 Viewer 可见 -->
    <template v-slot:extra>
      <a-button v-if="!isViewer" type="primary" @click="handleApproveEnable">Approve Enable</a-button>
    </template>
    <!-- Status：语义色圆点 + 浅色底 pill（同 Host 详情状态区样式） -->
    <template v-slot:extraContent>
      <div class="status-block">
        <div class="text">Status</div>
        <div class="status-pill" :style="{ background: statusBgColor, borderColor: statusColor }">
          <span class="status-dot" :style="{ background: statusColor }"></span>
          <span class="status-text" :style="{ color: statusColor }">{{ hostStatus }}</span>
        </div>
      </div>
    </template>

    <a-card :bordered="false">
      <!-- Hardware Information（审核记录表格，View 弹窗同 history 页） -->
      <div class="title">Hardware Information</div>
      <s-table
        row-key="key"
        :columns="hardwareColumns"
        :data="loadHardwareData"
        showPagination="auto"
      >
        <template slot="status" slot-scope="text">
          <a-badge :status="text | statusTypeFilter" :text="text | statusFilter" />
        </template>
        <template slot="action" slot-scope="text, record">
          <a @click="handleViewHardware(record)">view</a>
        </template>
      </s-table>

      <!-- 硬件信息审核详情弹窗（80vw + 折叠面板 + CodeDiff 左右对比：左=上次审批通过 右=本次更新） -->
      <a-modal
        title="Hardware Information Review"
        width="80vw"
        wrap-class-name="hardware-review-wrap"
        :dialog-style="{ top: '20px' }"
        :body-style="{ maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }"
        :visible="visible"
        @cancel="visible = false"
      >
        <!-- footer 仅保留 Cancel（只读查看弹窗，无需确认操作） -->
        <template slot="footer">
          <a-button @click="visible = false">Cancel</a-button>
        </template>
        <!-- 提示条与一键展开/一键收缩按钮同行，节省纵向空间 -->
        <div class="modal-tip-bar">
          <a-alert
            class="modal-tip"
            type="info"
            show-icon
            message="Compare the current update with the last approved hardware information. Green: Added, Red: Deleted, Yellow: Modified"
          />
          <!-- 单个切换按钮：已展开显示 Collapse All，已收缩显示 Expand All（样式参考列表页查询区域） -->
          <span class="modal-tip-actions">
            <a-button type="primary" :icon="allExpanded ? 'up' : 'down'" @click="toggleAllPanels">
              {{ allExpanded ? 'Collapse All' : 'Expand All' }}
            </a-button>
          </span>
        </div>
        <div style="margin-top: 20px;" v-show="modalConShow">
          <a-collapse v-model="activeKey">
            <!-- 可收缩面板为硬件信息 JSON 第一层级的 key（revision、mainboard、hsio、memory、security、soc 等） -->
            <a-collapse-panel v-for="section in diffSections" :key="section">
              <template slot="header">
                <div class="diff-panel-header">
                  <span class="diff-panel-title">{{ section }}</span>
                  <span class="diff-panel-stat">
                    <a-badge v-if="diffStats[section] && diffStats[section].isChanged" :count="'+' + diffStats[section].addNum" :number-style="{ backgroundColor: '#52c41a', marginLeft: '8px' }" />
                    <a-badge v-if="diffStats[section] && diffStats[section].isChanged" :count="'~' + diffStats[section].modNum" :number-style="{ backgroundColor: '#faad14', marginLeft: '8px' }" />
                    <a-badge v-if="diffStats[section] && diffStats[section].isChanged" :count="'-' + diffStats[section].delNum" :number-style="{ backgroundColor: '#f5222d', marginLeft: '8px' }" />
                    <a-tag v-if="diffStats[section] && !diffStats[section].isChanged" color="default">No Change</a-tag>
                  </span>
                </div>
              </template>
              <!-- 外框 + 左右标签头：左侧=历史数据（上次审批通过），右侧=当前数据（本次更新） -->
              <div class="diff-frame">
                <div class="diff-side-header">
                  <span class="side-label">Historical Data</span>
                  <span class="side-label">Current Data</span>
                </div>
                <!-- 左右对比：左侧=上一次审批通过，右侧=本次更新（同 history 页 CodeDiff 配置） -->
                <CodeDiff
                  :old-string="jTos((activeRecord.approvedData || {})[section])"
                  :new-string="jTos((activeRecord.pendingData || {})[section])"
                  output-format="side-by-side"
                  :context="10"
                  :highlight="true"
                  language="json"
                  maxHeight="60vh"
                  :hide-header="true"
                  :hide-stat="true"
                />
              </div>
            </a-collapse-panel>
          </a-collapse>
        </div>
      </a-modal>
    </a-card>
  </page-header-wrapper>
</template>

<script>
import { STable, Ellipsis } from '@/components'
import { CodeDiff } from 'v-code-diff'
import { roleMixin, PASSWORD_MASK } from '@/utils/roles'
import { countDiffStats } from './jsonDiff'
// 本次更新的硬件信息示例数据：直接使用项目根目录 HW.json（后续接入后端接口时替换为接口返回值）
import hwLatest from './hw.json'

const statusMap = {
  1: {
    status: 'processing',
    text: 'Pending Review'
  },
  2: {
    status: 'success',
    text: 'Approved'
  }
}

// HOST 状态 -> 语义色（与列表页 Status 标签配色一致）
const statusColorMap = {
  Idle: '#52c41a',
  Locked: '#faad14',
  Occupied: '#fa8c16',
  'Case Executing': '#1890ff',
  Offline: 'rgba(0, 0, 0, 0.45)',
  'Pending Activation': '#722ed1',
  'Hardware Modification': '#13c2c2',
  'Manually Disabled': '#fa541c',
  Updating: '#2f54eb'
}
// 状态 pill 浅色底（语义色 10% 左右的浅背景）
const statusBgColorMap = {
  Idle: '#f6ffed',
  Locked: '#fffbe6',
  Occupied: '#fff7e6',
  'Case Executing': '#e6f7ff',
  Offline: '#fafafa',
  'Pending Activation': '#f9f0ff',
  'Hardware Modification': '#e6fffb',
  'Manually Disabled': '#fff2e8',
  Updating: '#f0f5ff'
}

// 上一次审批通过的硬件信息示例：基于 HW.json 修改部分字段，便于演示对比效果（后续接入后端接口时替换）
const buildApprovedSnapshot = () => {
  const data = JSON.parse(JSON.stringify(hwLatest))
  data.revision = '0.0.9'
  data.mainboard.board.lsio.nvme_installed = true
  data.mainboard.board.peripheral.flash_programmer_installed = true
  data.mainboard.misc.bmc_version = 'bhs-25.05-0-ge1a2b3-5c6def2'
  data.mainboard.misc.cpld_version = '0.38'
  data.memory[0].memory.memory_meta_data.total_memory_size.value = 128
  data.memory[0].memory.channel = data.memory[0].memory.channel.filter(ch => ch.socket_id === 0)
  data.soc[1].soc.soc_feature.ddr5_freq = 4800
  return data
}
const snapshotApproved = buildApprovedSnapshot()

// 构造审核记录的快照数据（每条记录独立引用，便于后续替换为后端数据）
const buildRecord = (key, updateTime, reviewer, reviewTime, status) => ({
  key,
  updateTime,
  reviewer,
  reviewTime,
  status,
  // 本次更新的硬件信息（diff 左侧）
  pendingData: hwLatest,
  // 上一次审批通过的硬件信息（diff 右侧）
  approvedData: snapshotApproved
})

export default {
  name: 'PendingHostDetail',
  components: {
    STable,
    Ellipsis,
    CodeDiff
  },
  mixins: [roleMixin],
  data () {
    return {
      // Hardware Information 审核记录表头
      hardwareColumns: [
        { title: 'Update Time', dataIndex: 'updateTime' },
        { title: 'Reviewer', dataIndex: 'reviewer', customRender: (text) => text || '--' },
        { title: 'Review Time', dataIndex: 'reviewTime', customRender: (text) => text || '--' },
        { title: 'Review Status', dataIndex: 'status', scopedSlots: { customRender: 'status' } },
        {
          title: 'Action',
          dataIndex: 'action',
          width: '1%',
          scopedSlots: { customRender: 'action' }
        }
      ],
      // 模拟审核记录数据，后续接入后端接口时替换
      loadHardwareData: () => {
        return new Promise(resolve => {
          resolve({
            data: [
              buildRecord('1', '2026/3/18 20:09:21', '', '', 1),
              buildRecord('2', '2026/3/18 20:10:51', 'lisi@example.com', '2026/3/19 09:30:00', 2),
              buildRecord('3', '2026/3/18 20:11:18', 'wangwu@example.com', '2026/3/19 10:12:00', 2),
              buildRecord('4', '2026/3/18 20:20:40', 'lisi@example.com', '2026/3/19 11:45:00', 2)
            ],
            pageSize: 10,
            pageNo: 1,
            totalPage: 1,
            totalCount: 4
          })
        })
      },

      // 审核详情弹窗（样式同 history 页面）
      visible: false,
      modalConShow: false,
      activeKey: [],
      // 当前查看的记录（含 pending/approved 快照），默认给一条空数据避免首次渲染报错
      activeRecord: { pendingData: {}, approvedData: {} },
      // 各面板的 diff 统计（key 为 JSON 第一层级字段名，动态生成）
      diffStats: {}
    }
  },
  watch: {
    // 弹窗打开后标记「修改」行（CodeDiff 渲染完成后再扫描 DOM）
    visible (v) {
      if (v) {
        this.$nextTick(() => setTimeout(() => this.markModifiedRows(), 200))
      }
    },
    // 展开/收缩面板时 DOM 行可见性变化，重新标记
    activeKey () {
      this.$nextTick(() => this.markModifiedRows())
    }
  },
  filters: {
    statusFilter (type) {
      return statusMap[type] ? statusMap[type].text : type
    },
    statusTypeFilter (type) {
      return statusMap[type] ? statusMap[type].status : 'default'
    }
  },
  computed: {
    // 面包屑路由：Pending HOST（父级功能，可点击）/ Pending HOST 详情（当前页）
    breadcrumbRoutes () {
      return [
        { path: '/pending-host', breadcrumbName: this.$t('menu.pending-host') },
        { path: '/pending-host/detail', breadcrumbName: 'Pending HOST Detail' }
      ]
    },
    breadcrumb () {
      return { props: { routes: this.breadcrumbRoutes, itemRender: this.breadcrumbItemRender } }
    },
    // 来自 Pending HOST 列表页 View 跳转携带的 query；直接访问时用示例数据兜底
    hostId () {
      return this.$route.query.id || '1853587106098639542'
    },
    hostInfo () {
      const query = this.$route.query
      return {
        hostname: query.hostname || 'MG006',
        ip: query.ip || '00:11:22:33:44:60',
        mac: query.mac || '00:11:22:33:44:60',
        machineGuid: query.machineGuid || 'MG006',
        password: query.password || 'Host001@2025'
      }
    },
    hostStatus () {
      return this.$route.query.status || 'Pending Activation'
    },
    // 密码按登录角色展示：Admin 明文 / 其它角色（Lab Tech 等）掩码
    passwordDisplay () {
      return this.isAdmin ? this.hostInfo.password : PASSWORD_MASK
    },
    // 弹窗可收缩面板 = 硬件信息 JSON 第一层级的 key（revision、mainboard、hsio、memory、security、soc 等）
    diffSections () {
      return Object.keys(this.activeRecord.pendingData || {})
    },
    statusColor () {
      return statusColorMap[this.hostStatus] || 'rgba(0, 0, 0, 0.45)'
    },
    statusBgColor () {
      return statusBgColorMap[this.hostStatus] || '#fafafa'
    },
    // 是否全部面板已展开（用于切换按钮的文字/图标状态）
    allExpanded () {
      return this.diffSections.length > 0 && this.activeKey.length === this.diffSections.length
    }
  },
  methods: {
    // 对象转格式化 JSON 字符串（供 CodeDiff 左右对比展示）
    jTos (v) {
      return JSON.stringify(v, null, 2)
    },
    // 标记「修改」行：side-by-side 中 key 相同、value 变化表现为同一行左删右增，
    // 为这类行加 modified-row 类，配合样式染成黄色（纯新增/纯删除保持绿/红）
    // 注意：a-modal 挂载在 document.body 下（不在组件 $el 内），需按 wrapClassName 定位弹窗节点
    markModifiedRows () {
      const wrap = document.querySelector('.hardware-review-wrap')
      if (!wrap) return
      const rows = wrap.querySelectorAll('.file-diff-split tr[data-diff-change]')
      rows.forEach(tr => {
        const left = tr.querySelector('.split-side-left')
        const right = tr.querySelector('.split-side-right')
        if (
          left && right &&
          left.classList.contains('blob-code-deletion') &&
          right.classList.contains('blob-code-addition')
        ) {
          tr.classList.add('modified-row')
        }
      })
    },
    // 面包屑项渲染：末级为当前页显示纯文本；非末级用 router-link 跳回父级功能
    // （history 路由模式下不能用 Breadcrumb 默认的 href="#/x" 链接）
    breadcrumbItemRender ({ route, h }) {
      const routes = this.breadcrumbRoutes
      if (route.path === routes[routes.length - 1].path) {
        return h('span', [route.breadcrumbName])
      }
      return h('router-link', { props: { to: route.path } }, [route.breadcrumbName])
    },
    // 查看审核详情：打开弹窗并重置折叠面板（同 history 页交互）
    handleViewHardware (record) {
      this.activeRecord = record
      // 统计各面板新增/删除/修改字段数（+绿 / ~黄 / -红 徽标）
      this.computeDiffStats()
      this.visible = true
      // 先展开全部面板再收起，触发折叠面板重置动画
      this.activeKey = Object.keys(record.pendingData || {})
      this.modalConShow = false
      this.$nextTick(() => {
        setTimeout(() => {
          this.activeKey = []
        }, 50)
        setTimeout(() => {
          this.modalConShow = true
        }, 100)
      })
    },
    // 切换全部面板：已展开则全部收缩，已收缩则全部展开
    toggleAllPanels () {
      this.activeKey = this.allExpanded ? [] : [...this.diffSections]
    },
    // 审批启用：二次确认（占位操作，后续接入后端接口时替换 onOk 内逻辑）
    handleApproveEnable () {
      this.$confirm({
        title: 'Approve Enable',
        content: 'Are you sure to approve and enable this host?',
        okText: 'Approve',
        cancelText: 'Cancel',
        onOk () {
          // TODO: 接入后端审批接口
        }
      })
    },
    // 统计各面板的叶子级差异数量（新增/删除/修改）
    computeDiffStats () {
      const stats = {}
      const pending = this.activeRecord.pendingData || {}
      const approved = this.activeRecord.approvedData || {}
      Object.keys(pending).forEach(key => {
        stats[key] = countDiffStats(approved[key], pending[key])
      })
      this.diffStats = stats
    }
  }
}
</script>

<style lang="less" scoped>

.pending-host-detail-tabs{
  height: calc(100vh - 64px)!important;
  display: block !important;
  overflow-y: auto !important;
}

// 板块标题（Hardware Information）
.title {
  color: rgba(0, 0, 0, .85);
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
}

// 提示条与操作按钮同行：提示条占满剩余宽度，按钮组固定在右侧垂直居中
.modal-tip-bar {
  display: flex;
  align-items: center;
  margin-top: 4px;

  .modal-tip {
    flex: auto;
    min-width: 0;
  }

  .modal-tip-actions {
    flex: none;
    margin-left: 16px;
    white-space: nowrap;
  }
}

// 状态区：语义色圆点 + 浅色底 pill（同 Host 详情状态区样式）
.status-block {
  text-align: right;

  .text {
    margin-bottom: 4px;
    font-weight: 600;
  }
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border: 1px solid;
  border-radius: 4px;

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 8px;
  }

  .status-text {
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
  }
}

// 识别信息区：技术标识符用等宽字体，hover 时浮现复制图标（同 Host 详情顶部信息区样式）
.host-meta {
  /deep/ .ant-descriptions-item-content {
    color: rgba(0, 0, 0, 0.85);
  }

  .meta-value {
    font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
  }
}

// 操作列链接不折行；表头单行显示（操作列收缩到内容宽度后，表头文字不允许折行）
/deep/ .ant-table-thead > tr > th {
  white-space: nowrap;
}

/deep/ .ant-table-tbody > tr > td {
  word-break: keep-all;
  padding-left: 16px;
  padding-right: 16px;
}

.diff-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-right: 8px;
}

.diff-panel-title {
  font-weight: 500;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.85);
}

.diff-panel-stat {
  display: inline-flex;
  align-items: center;
}

/deep/ .ant-collapse {
  .ant-collapse-content {
    .ant-collapse-content-box {
      padding: 0;

      .code-diff-view {
        margin-top: 0;
        margin-bottom: 0;
        border: 1px solid #e8e8e8;
        border-top: none;
        border-radius: 0 0 4px 4px;
      }
    }
  }
}

// diff 区外框 + 左右标签头：标签头两格各占 50%，与 side-by-side 左右两栏对齐；
// 标签头与下方 diff 表格拼成一个完整外框
.diff-frame {
  .diff-side-header {
    display: flex;
    border: 1px solid #e8e8e8;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    background: #fafafa;

    .side-label {
      flex: 1;
      padding: 8px 22px;
      font-size: 13px;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.85);

      &:first-child {
        border-right: 1px solid #e8e8e8;
      }
    }
  }
}

// 「修改」行：同一行左删右增（key 不变、value 变化），左右两侧统一染黄；
// 纯新增行（左空右增）保持绿色、纯删除行（左删右空）保持红色
/deep/ .file-diff-split {
  tr.modified-row {
    .blob-code-deletion,
    .blob-code-addition {
      background-color: #fffbe6;
    }

    .blob-num-deletion,
    .blob-num-addition {
      background-color: #fff1b8;
    }
  }
}
</style>
