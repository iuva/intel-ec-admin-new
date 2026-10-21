<template>
  <!-- 页头标题：HOST ID（同 Host 详情页）；面包屑：Pending HOST（点击回列表）/ Pending HOST 详情（当前页） -->
  <page-header-wrapper
    class="pending-host-detail-tabs"
    :title="'HOST ID: ' + hostId"
    :breadcrumb="breadcrumb"
  >
    <!-- content（左：Identification Information）与 extraContent（右：Status）在同一 flex 行，实现左右布局 -->
    <template v-slot:content>
      <a-spin :spinning="detailLoading">
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
            <span class="meta-value">{{ hostInfo.port }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="Password">
            <span class="meta-value">{{ passwordDisplay }}</span>
          </a-descriptions-item>
        </a-descriptions>
      </a-spin>
    </template>
    <!-- actions：页头右上角操作区（同 Host 详情页 extra 布局）；按钮权限配置见 src/permission.js -->
    <template v-slot:extra>
      <a-button v-action:host:approve type="primary" @click="handleApproveEnable">Approve Enable</a-button>
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
        ref="hwTable"
        row-key="hw_rec_id"
        :columns="hardwareColumns"
        :data="loadHwRecords"
        :dataBefore="hwRecordsReq"
        :dataAfter="hwRecordsRes"
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
import { fetchPendingHostDetail, activateHost, getHwRecord, getHWV } from '@/api/appr-host'
import { stateDict } from '@/store/dict'

// 业务错误提示：优先展示服务端 message（如 422 approve_failed/process_failed）
const getErrMsg = (e, fallback) => (e && e.response && e.response.data && e.response.data.message) || fallback

// hw-records 行状态 sync_state（§3.3 硬件变更历史列表：0空/1待同步/2生效/3失败/4审批通过）→ Review Status 徽标
const statusMap = {
  0: {
    status: 'default',
    text: '--'
  },
  1: {
    status: 'processing',
    text: 'Pending Review'
  },
  2: {
    status: 'success',
    text: 'Approved'
  },
  3: {
    status: 'error',
    text: 'Failed'
  },
  4: {
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

export default {
  name: 'PendingHostDetail',
  components: {
    STable,
    Ellipsis,
    CodeDiff
  },
  mixins: [roleMixin],
  created () {
    // 路由唯一且必须携带 host_id（列表页 View 跳转携带），缺失时回列表页
    if (!this.hostId) {
      this.$message.warning('Missing required parameter: host_id')
      this.$router.replace('/pending-host')
      return
    }
    this.fetchDetail()
  },
  data () {
    return {
      // 详情数据加载中
      detailLoading: false,
      // 待审批主机详情（§4.3：GET /appr-host/detail，信息表字段以接口文档为准：
      // host_no/host_ip/mac_addr/mg_id/host_state/diff_state，与 §4.1 行字段命名一致）
      detail: {},
      // Hardware Information 审核记录表头（行字段以接口文档 §3.3 硬件变更历史列表为准）
      hardwareColumns: [
        {
          title: 'Update Time',
          dataIndex: 'updated_time',
          customRender: (text, record) => text || record.created_time || '-'
        },
        {
          title: 'Reviewer',
          dataIndex: 'appr_by_name',
          customRender: (text, record) => text || record.appr_by || '--'
        },
        {
          title: 'Review Time',
          dataIndex: 'appr_time',
          customRender: (text, record) => text || record.appr_time || '--'
        },
        { title: 'Review Status', dataIndex: 'sync_state', scopedSlots: { customRender: 'status' } },
        {
          title: 'Action',
          dataIndex: 'action',
          width: '1%',
          scopedSlots: { customRender: 'action' }
        }
      ],

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
    // 同路由不同 host_id（组件复用）时重新拉取详情
    '$route.query.id' () {
      if (this.hostId) {
        this.fetchDetail()
      }
    },
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
    // 路由唯一且必须参数：host_id（列表页 View 跳转携带）
    hostId () {
      return this.$route.query.id || ''
    },
    // 基础信息：字段以接口文档 §4.3 信息表为准（与 §4.1 行字段命名一致）
    hostInfo () {
      const d = this.detail
      return {
        hostname: d.host_no || '-',
        ip: d.ip || '-',
        mac: d.mac || '-',
        port: d.port || '-',
        machineGuid: d.mg_id || '-',
        password: d.password || '-'
      }
    },
    // 主机状态：host_state（int，5=待激活 6=硬件变更 7=已停用 8=Updating）映射为状态文案（与列表页 stateDict 口径一致）
    hostStatus () {
      const s = this.detail.host_state
      return stateDict.host[s] ? stateDict.host[s].text : '-'
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
    // 拉取待审批主机详情（§4.3：GET /appr-host/detail?host_id=xxx）
    // 出参：信息表 + 硬件评审历史 + 待审批 diff 数据（评审历史/diff 暂未下发，当前仅消费信息表）
    fetchDetail () {
      this.detailLoading = true
      fetchPendingHostDetail({ host_id: this.hostId }).then(res => {
        this.detail = res.data
      }).catch(e => {
        this.$message.error(getErrMsg(e, 'Failed to load pending host detail'))
      }).finally(() => {
        this.detailLoading = false
      })
    },
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
    // 加载数据方法（必须为 Promise 对象）：§3.3 硬件变更历史列表，path 入参 host_id
    loadHwRecords (params) {
      return getHwRecord(this.hostId, params)
    },
    // 请求前参数处理：s-table 通用分页参数转换为契约分页参数（page/page_size，筛选参数均非必填）
    hwRecordsReq (params) {
      params.page = params.pageNo
      params.page_size = params.pageSize
      delete params.pageNo
      delete params.pageSize
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === undefined || params[key] === null) {
          delete params[key]
        }
      })
    },
    // 响应后数据映射：契约分页结构转 s-table 结构（page/total + 行数组）
    hwRecordsRes (res) {
      const payload = res || {}
      const rows = payload.list
      return {
        pageNo: payload.page || 1,
        totalCount: payload.total !== undefined ? payload.total : rows.length,
        data: rows
      }
    },
    // 查看审核详情（§4.2 按记录取硬件版本：GET /appr-host/hw/{hw_rec_id}）
    // hw_info=本次待审批新版（Current Data）；previous.hw_info=上一次审批通过（Historical Data），previous 为 null 时左侧为空
    handleViewHardware (record) {
      getHWV(record.hw_rec_id).then(res => {
        const d = res || {}
        this.activeRecord = {
          pendingData: d.hw_info || {},
          approvedData: (d.previous && d.previous.hw_info) || {}
        }
        // 统计各面板新增/删除/修改字段数（+绿 / ~黄 / -红 徽标）
        this.computeDiffStats()
        this.visible = true
        // 先展开全部面板再收起，触发折叠面板重置动画
        this.activeKey = Object.keys(this.activeRecord.pendingData || {})
        this.modalConShow = false
        this.$nextTick(() => {
          setTimeout(() => {
            this.activeKey = []
          }, 50)
          setTimeout(() => {
            this.modalConShow = true
          }, 100)
        })
      }).catch(e => {
        this.$message.error(getErrMsg(e, 'Failed to load hardware version detail'))
      })
    },
    // 切换全部面板：已展开则全部收缩，已收缩则全部展开
    toggleAllPanels () {
      this.activeKey = this.allExpanded ? [] : [...this.diffSections]
    },
    // 审批启用（§4.2：POST /appr-host/approve，body {host_ids[], diff_type?}）
    // diff_type 取详情 diff_state（1=版本变更 2=内容变更），与列表页单行审批口径一致
    handleApproveEnable () {
      const that = this
      this.$confirm({
        title: 'Approve Enable',
        content: `Are you sure to approve and enable Host ${this.hostInfo.hostname} (${this.hostInfo.ip})?`,
        okText: 'Approve',
        cancelText: 'Cancel',
        onOk () {
          const payload = { host_ids: [that.hostId] }
          if (that.detail && that.detail.diff_state) {
            payload.diff_type = that.detail.diff_state
          }
          activateHost(payload).then(() => {
            that.$message.success(`Host ${that.hostInfo.hostname} has been approved and enabled`)
            // 审批通过后主机移出待审批池，返回列表页
            that.$router.replace('/pending-host')
          }).catch(e => {
            that.$message.error(getErrMsg(e, `Failed to approve Host ${that.hostInfo.hostname}`))
          })
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
