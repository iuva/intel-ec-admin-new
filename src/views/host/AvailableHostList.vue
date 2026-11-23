<template>
  <!-- 一级功能页：面包屑仅显示功能名本身（覆盖 matched 多层级默认渲染） -->
  <page-header-wrapper :breadcrumb="{ props: { routes: [{ path: '/available-host', breadcrumbName: $t('menu.host-management') }] } }">
    <a-card :bordered="false">
      <div class="table-page-search-wrapper">
        <a-form layout="inline">
          <a-row :gutter="48">
            <a-col :md="8" :sm="24">
              <a-form-item label="Hostname">
                <a-input v-model="queryParam.hostname" placeholder="Enter Hostname" />
              </a-form-item>
            </a-col>
            <a-col :md="8" :sm="24">
              <a-form-item label="IP">
                <a-input v-model="queryParam.ip" placeholder="Enter IP" />
              </a-form-item>
            </a-col>
            <a-col :md="8" :sm="24">
              <a-form-item label="Status">
                <!-- 变量名以接口文档 §3.1 为准：host_state（int 0..4，空串=All 不下发） -->
                <a-select v-model="queryParam.host_state" placeholder="Please select">
                  <a-select-option value="">All</a-select-option>
                  <a-select-option :value="0">Free</a-select-option>
                  <a-select-option :value="1">Locked</a-select-option>
                  <a-select-option :value="2">Occupied</a-select-option>
                  <a-select-option :value="3">Running</a-select-option>
                  <a-select-option :value="4">Offline</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :md="8" :sm="24">
              <a-form-item label="User">
                <!-- 占用者模糊过滤，变量名以接口文档 §3.1 为准 -->
                <a-input v-model="queryParam.use_by" placeholder="Enter User" />
              </a-form-item>
            </a-col>
            <template v-if="advanced">
              <a-col :md="8" :sm="24">
                <a-form-item label="MAC">
                  <a-input v-model="queryParam.mac" placeholder="Enter MAC" />
                </a-form-item>
              </a-col>
              <a-col :md="8" :sm="24">
                <a-form-item label="MachineGuid">
                  <a-input v-model="queryParam.mg_id" placeholder="Enter MachineGuid" />
                </a-form-item>
              </a-col>
            </template>
            <a-col :md="!advanced && 8 || 24" :sm="24">
              <span class="table-page-search-submitButtons" :class="{ 'buttons-collapsed': !advanced }" :style="advanced && { float: 'right', overflow: 'hidden' } || {} ">
                <a-button type="primary" @click="$refs.table.refresh(true)">Search</a-button>
                <a-button style="margin-left: 8px" @click="handleReset">Reset</a-button>
                <a @click="toggleAdvanced" style="margin-left: 8px">
                  {{ advanced ? 'Collapse' : 'Expand' }}
                  <a-icon :type="advanced ? 'up' : 'down'"/>
                </a>
              </span>
            </a-col>
          </a-row>
        </a-form>
      </div>

      <s-table
        ref="table"
        size="default"
        rowKey="host_id"
        :columns="columns"
        :data="fetchEnabledList"
        :dataAfter="hostListRes"
        :dataBefore="hostListReq"
        :params="queryParam"
        showPagination="auto"
      >
        <span slot="status" slot-scope="text">
          <a-tag :color="text | statusColorFilter">{{ text | statusFilter }}</a-tag>
        </span>

        <span slot="action" slot-scope="text, record" class="host-actions">
          <a @click="handleView(record)">View</a>
          <!-- 按钮权限：v-action 配置见 src/permission.js -> ROLE_CONFIG[role].actions -->
          <a-divider v-action:host:disable type="vertical" />
          <a v-action:host:disable @click="handleDisable(record)" :class="{ 'disabled-link': record.host_state === 1 || record.host_state === 3 }">Disable</a>
          <!-- 已 Offline 的 Host 不允许再次下线，禁用 Go Offline -->
          <a-divider v-action:host:offline type="vertical" />
          <a
            v-action:host:offline
            :class="{ 'disabled-link': record.host_state === 4 }"
            @click="handleOffline(record)"
          >Go Offline</a>
        </span>
      </s-table>
    </a-card>
  </page-header-wrapper>
</template>

<script>
import moment from 'moment'
import { STable, Ellipsis } from '@/components'
import { fetchEnabledList, deactivateHost, forceOfflineHost } from '@/api/host'
import { stateDict } from '@/store/dict'
import { nextTick } from 'vue'

// 占用起始时间 → 距今时长（Xh YYm），口径参考 Home.vue formatDuration
const formatDuration = since => {
  if (!since) return '-'
  const minutes = Math.max(0, moment().diff(moment(since), 'minutes'))
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

// 业务错误提示：优先展示服务端 message（如 409 FORCE_OFFLINE_APPR_EXISTS）
const getErrMsg = (e, fallback) => (e && e.response && e.response.data && e.response.data.message) || fallback

// 列表行字段以接口文档 §3.1 为准（host_id/host_no/host_ip/host_state/use_by/occupied_since...）
const columns = [
  {
    title: 'Host ID',
    dataIndex: 'host_id'
  },
  {
    title: 'Hostname',
    dataIndex: 'host_no'
  },
  {
    title: 'IP',
    dataIndex: 'host_ip'
  },
  {
    title: 'Status',
    dataIndex: 'host_state',
    scopedSlots: { customRender: 'status' }
  },
  {
    title: 'User',
    dataIndex: 'use_by',
    // 占用者为空（未被占用）时显示「-」
    customRender: text => text || '-'
  },
  {
    title: 'MAC',
    dataIndex: 'mac',
    // 占用者为空（未被占用）时显示「-」
    customRender: text => text || '-'
  },
  {
    title: 'Machine Guid',
    dataIndex: 'mg_id',
    // 占用者为空（未被占用）时显示「-」
    customRender: text => text || '-'
  },
  {
    title: 'Occupied Duration',
    dataIndex: 'occupied_since',
    // 仅 state 1/2/3 有占用起始（孤儿日志守卫），前端 now - occupied_since 计算时长，其它状态显示「-」
    customRender: text => (text ? formatDuration(text) : '-')
  },
  {
    title: 'Action',
    dataIndex: 'action',
    // width: '1%' 为最小宽度提示：操作列收缩到内容宽度并整体靠右，
    // 右缘到表格右侧的 16px 内边距与 ID 列左缘的 16px 间距对称；
    // 列内保持左对齐，富余宽度全部分给数据列
    scopedSlots: { customRender: 'action' }
  }
]


export default {
  name: 'AvailableHostList',
  components: {
    STable,
    Ellipsis
  },
  data () {
    this.columns = columns
    return {
      // 高级搜索 展开/关闭
      advanced: false,
      // 查询参数（变量名以接口文档 §3.1 为准）
      queryParam: {},
      fetchEnabledList
    }
  },
  created () {
    // 从首页等页面跳转进入时，解析 URL query 中的搜索条件并回显
    this.applyRouteQuery()
  },
  activated () {
    // keepAlive 页面再次带条件进入时，重新应用筛选并刷新
    this.applyRouteQuery()
  },
  filters: {
    statusFilter (type) {
      return stateDict.host[type] ? stateDict.host[type].text : type
    },
    statusColorFilter (type) {
      return stateDict.host[type] ? stateDict.host[type].color : 'default'
    }
  },
  methods: {
    // 解析 URL query 携带的搜索条件（参数名与搜索框变量一致，以接口文档 §3.1 为准），回显且按条件加载
    applyRouteQuery () {
      const query = this.$route.query
      const keys = ['hostname', 'ip', 'host_state', 'use_by', 'mac', 'mg_id']
      let changed = false
      keys.forEach(key => {
        if (query[key] === undefined) {
          return
        }
        // host_state 契约为 int；URL 携带为字符串需转数字（空串=All 保持原样）
        const val = key === 'host_state' && query[key] !== '' ? Number(query[key]) : query[key]
        if (this.queryParam[key] !== val) {
          this.$set(this.queryParam, key, val)
          changed = true
        }
      })
      // 首次进入时 s-table 未挂载，由初始加载读取 queryParam；keepAlive 再次进入时手动刷新
      if (changed && this.$refs.table) {
        this.$refs.table.refresh(true)
      }
    },
    // 请求前参数处理：s-table 通用分页参数转换为契约分页参数，并剔除空值搜索条件
    hostListReq (params) {
      params.page = params.pageNo
      params.page_size = params.pageSize
      delete params.pageNo
      delete params.pageSize
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === undefined || params[key] === null) {
          delete params[key]
        }
      })
      // host_state 按契约为 int（0..4），URL 回显/下拉混合来源统一转数字
      if (params.host_state !== undefined) {
        params.host_state = Number(params.host_state)
      }
    },
    hostListRes (res) {
      return {
        pageNo: res.data.page,
        totalCount: res.data.total,
        data: res.data.hosts
      }
    },
    toggleAdvanced () {
      this.advanced = !this.advanced
    },
    handleReset () {
      this.queryParam = {}
      nextTick(() => {
        this.$refs.table.refresh(true)
      })
    },
    // 跳转到 Host 详情页（/available-host/detail）
    // 详情页路由唯一且必须携带 host_id，其余信息均由详情接口按 host_id 拉取
    handleView (record) {
      this.$router.push({
        path: '/available-host/detail',
        query: {
          host_id: record.host_id
        }
      })
    },
    handleDisable (record) {
      if (record.host_state === 1 || record.host_state === 3) return
      const that = this
      this.$confirm({
        title: 'Disable Host',
        // 询问是否禁用 + 说明禁用后果（进入 Pending HOST）
        content: `Are you sure you want to disable Host ${record.host_no} (${record.host_ip})? After being disabled, the Host will be moved to Pending HOST.`,
        onOk () {
          // 停用主机（§3.2：PUT /host/disable）
          deactivateHost({ host_id: record.host_id }).then(() => {
            that.$message.success(`Host ${record.host_no} has been disabled`)
            that.$refs.table.refresh()
          }).catch(e => {
            that.$message.error(getErrMsg(e, `Failed to disable Host ${record.host_no}`))
          })
        }
      })
    },
    handleOffline (record) {
      // 已 Offline（host_state=4）的 Host 禁止再次下线
      if (record.host_state === 4) return
      const that = this
      this.$confirm({
        title: 'Go Offline',
        // 下发离线通知，Host 收到后进行初始化
        content: `Are you sure to send an offline notification to Host ${record.host_no} (${record.host_ip})? Once the notification is sent, the host will be initialized.`,
        okText: 'Send Notification',
        onOk () {
          // 强制下线（§3.2 C4 分叉）：FREE 态直接置 Offline；非 FREE 态转为审批申请进 Pending Approvals
          forceOfflineHost({ host_id: record.host_id }).then(res => {
            if (res.data && res.data.state === 'pending_approval') {
              that.$message.success(`A forced-offline approval request has been submitted for Host ${record.host_no}`)
            } else {
              that.$message.success(`Offline notification has been sent to Host ${record.host_no}`)
            }
            that.$refs.table.refresh()
          }).catch(e => {
            that.$message.error(getErrMsg(e, `Failed to send offline notification to Host ${record.host_no}`))
          })
        }
      })
    }
  }
}
</script>

<style lang="less" scoped>
// 搜索区域：标签固定宽度右对齐，保证各列控件起始位置统一
.table-page-search-wrapper {
  /deep/ .ant-form-item-label {
    flex: 0 0 96px;
    text-align: right;

    > label {
      width: 100%;
      text-align: right;
    }
  }

  // 收起状态时按钮与同行输入控件垂直对齐，并与上方输入框（如 IP）水平左对齐
  .table-page-search-submitButtons {
    height: 32px;
    line-height: 32px;
  }

  .table-page-search-submitButtons.buttons-collapsed {
    // 96px 与标签固定宽度一致，使按钮起始位置与输入框左边缘对齐
    padding-left: 96px;
  }
}

// 表格视觉：各列「均分」指列间距一致——单元格左右内边距统一（默认16px），
// 列宽由内容自适应动态重排；单词（如邮箱）内不折行
/deep/ .ant-table-tbody > tr > td {
  word-break: keep-all;
  padding-left: 16px;
  padding-right: 16px;
}

.host-actions {
  display: inline-flex;
  // 禁止折行：操作列按最小内容宽度收缩时，最小宽度即整行链接宽度，
  // 保证 View~Go Offline 始终单行显示
  flex-wrap: nowrap;
  white-space: nowrap;
  align-items: center;

  // 收紧分隔线间距，与单元格 padding 协调，保持列间距视觉一致
  /deep/ .ant-divider-vertical {
    margin: 0 4px;
  }
}

// 禁用态操作链接：置灰、去除交互反馈
.disabled-link {
  color: rgba(0, 0, 0, 0.25);
  cursor: not-allowed;

  &:hover {
    color: rgba(0, 0, 0, 0.25);
  }
}
</style>
