<template>
  <!-- 一级功能页：面包屑仅显示功能名本身（覆盖 matched 多层级默认渲染） -->
  <page-header-wrapper :breadcrumb="{ props: { routes: [{ path: '/pending-host', breadcrumbName: $t('menu.pending-host') }] } }">
    <a-card :bordered="false">
      <div class="table-page-search-wrapper">
        <a-form layout="inline">
          <a-row :gutter="48">
            <a-col :md="7" :sm="22">
              <a-form-item label="Hostname">
                <a-input v-model="queryParam.hostname" placeholder="Enter Hostname" />
              </a-form-item>
            </a-col>
            <a-col :md="7" :sm="22">
              <a-form-item label="IP">
                <a-input v-model="queryParam.host_ip" placeholder="Enter IP" />
              </a-form-item>
            </a-col>
            <a-col :md="6" :sm="22">
              <a-form-item label="Status">
                <!-- 变量名以接口文档 §4.1 为准：host_state（int 精确过滤，5=待激活 6=硬件变更 7=已停用；8=Updating 取自前端状态字典） -->
                <a-select v-model="queryParam.host_state" placeholder="Please select">
                  <a-select-option value="">All</a-select-option>
                  <a-select-option :value="5">Pending Activation</a-select-option>
                  <a-select-option :value="6">Hardware Modification</a-select-option>
                  <a-select-option :value="7">Manually Disabled</a-select-option>
                  <a-select-option :value="8">Updating</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>

            <a-col :md="4" :sm="24">
              <span class="table-page-search-submitButtons" :class="{ 'buttons-collapsed': !advanced }" :style="advanced && { float: 'right', overflow: 'hidden' } || {} ">
                <a-button type="primary" @click="$refs.table.refresh(true)">Search</a-button>
                <a-button style="margin-left: 8px" @click="handleReset">Reset</a-button>
              </span>
            </a-col>
          </a-row>
        </a-form>
      </div>

      <!-- 操作按钮权限：v-action 配置见 src/permission.js -> ROLE_CONFIG[role].actions -->
      <div class="table-operator">
        <a-button v-action:host:approve type="primary" icon="check-circle" :disabled="!hasSelected" @click="handleBatchApprove">Batch Approve Version Upgrade</a-button>
        <a-button v-action:host:email icon="mail" style="margin-left: 8px" @click="handleMaintainEmail">Maintain Notification Email</a-button>
      </div>

      <s-table
        ref="table"
        size="default"
        rowKey="host_id"
        :columns="columns"
        :data="fetchPendingList"
        :dataBefore="pendingListReq"
        :dataAfter="pendingListRes"
        :params="queryParam"
        :alert="{ show: true, clear: true }"
        :rowSelection="rowSelection"
        showPagination="auto"
      >
        <span slot="status" slot-scope="text">
          <a-tag :color="text | statusColorFilter">{{ text | statusFilter }}</a-tag>
        </span>

        <span slot="action" slot-scope="text, record" class="host-actions">
          <a v-action:host:approve @click="handleApproveEnable(record)">Approve Enable</a>
          <a-divider v-action:host:approve type="vertical" />
          <a @click="handleView(record)">View</a>
          <a-divider v-action:host:delete type="vertical" />
          <a v-action:host:delete class="danger-link" @click="handleDelete(record)">Delete</a>
        </span>
      </s-table>

      <!-- 维护通知邮箱弹窗 -->
      <a-modal
        title="Maintain Notification Email"
        :width="520"
        v-model="emailVisible"
        :confirm-loading="emailSubmitting"
        @ok="handleEmailOk"
      >
        <a-alert
          type="info"
          show-icon
          style="margin-bottom: 24px"
          :message="emailLoading ? 'Loading current email...' : `Current email: ${currentEmail || 'Not set'}`"
        />
        <!-- 与 Update Password 弹窗一致的 a-form + v-decorator 写法，保证 label 和表单项间距正常渲染 -->
        <a-form :form="emailForm" v-bind="emailFormItemLayout" class="email-form">
          <a-form-item label="New Email">
            <a-input
              v-decorator="['email', { rules: [{ required: true, message: 'Please enter new email' }, { type: 'email', message: 'Invalid email format' }] }]"
              placeholder="Enter new email"
            />
          </a-form-item>
          <a-form-item label="Confirm Email">
            <a-input
              v-decorator="['confirmEmail', { rules: [{ required: true, message: 'Please confirm new email' }, { validator: handleConfirmEmail }] }]"
              placeholder="Confirm new email"
            />
          </a-form-item>
        </a-form>
      </a-modal>
    </a-card>
  </page-header-wrapper>
</template>

<script>
import { STable, Ellipsis } from '@/components'
import { fetchPendingList, activateHost, fetchMaintainEmail, maintainEmail } from '@/api/appr-host'
import { deleteEnabledHost } from '@/api/host'
import { stateDict } from '@/store/dict'
import { nextTick } from 'vue'

// 业务错误提示：优先展示服务端 message（如 422 EMAIL_CONFIRM_MISMATCH）
const getErrMsg = (e, fallback) => (e && e.response && e.response.data && e.response.data.message) || fallback

export default {
  name: 'PendingHostList',
  components: {
    STable,
    Ellipsis
  },
  beforeCreate () {
    // 维护通知邮箱表单（a-form + v-decorator）
    this.emailForm = this.$form.createForm(this)
  },
  data () {
    return {
      // 高级搜索 展开/关闭
      advanced: false,
      // 查询参数（变量名以接口文档 §4.1 为准）
      queryParam: {},
      // 表格多选
      selectedRowKeys: [],
      selectedRows: [],
      rowSelection: {
        selectedRowKeys: [],
        onChange: (selectedRowKeys, selectedRows) => {
          this.selectedRowKeys = selectedRowKeys
          this.selectedRows = selectedRows
        }
      },
      // 维护通知邮箱弹窗
      emailVisible: false,
      // 当前邮箱查询中（弹窗打开时实时拉取）
      emailLoading: false,
      // 保存邮箱请求中（OK 按钮 confirm-loading，防重复提交）
      emailSubmitting: false,
      // 弹窗表单布局：与 Update Password 弹窗一致（labelCol 7 / wrapperCol 13）
      emailFormItemLayout: {
        labelCol: { lg: { span: 7 }, sm: { span: 7 } },
        wrapperCol: { lg: { span: 13 }, sm: { span: 15 } }
      },
      // 当前生效的通知邮箱（弹窗打开时经「维护邮箱-查」接口实时获取）
      currentEmail: '',
      // 加载数据方法 必须为 Promise 对象
      fetchPendingList,
      columns: [
        {
          title: 'Host ID',
          dataIndex: 'host_id'
        },
        {
          title: 'Hostname',
          dataIndex: 'host_no',
          customRender: text => text || '-'
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
          title: 'Submission Time',
          dataIndex: 'subm_time'
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
    }
  },
  computed: {
    hasSelected () {
      return this.selectedRowKeys.length > 0
    }
  },
  created () {
    // 从 Dashboard 指标卡跳转进入时，按 URL query 自动筛选状态
    this.applyRouteStatus()
  },
  activated () {
    // keepAlive 页面再次从 Dashboard 带状态进入时，重新应用筛选并刷新
    this.applyRouteStatus()
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
    // 应用 URL query 中的状态筛选（仅当 query 带 host_state 参数时生效）
    applyRouteStatus () {
      const status = this.$route.query.host_state
      if (status === undefined || String(status) === String(this.queryParam.host_state)) {
        return
      }
      // host_state 契约为 int；URL 携带为字符串需转数字（空串=All 保持原样）
      this.$set(this.queryParam, 'host_state', status === '' ? '' : Number(status))
      // 首次进入时 s-table 未挂载，由初始加载读取 queryParam；keepAlive 再次进入时手动刷新
      if (this.$refs.table) {
        this.$refs.table.refresh(true)
      }
    },
    // 请求前参数处理：s-table 通用分页参数转换为契约分页参数，并剔除空值搜索条件
    pendingListReq (params) {
      params.page = params.pageNo
      params.page_size = params.pageSize
      delete params.pageNo
      delete params.pageSize
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === undefined || params[key] === null) {
          delete params[key]
        }
      })
      // host_state 按契约为 int（5/6/7/8），URL 回显/下拉混合来源统一转数字
      if (params.host_state !== undefined) {
        params.host_state = Number(params.host_state)
      }
    },
    // 响应后数据映射：契约分页结构转 s-table 结构（page/page_size/total + hosts）
    pendingListRes (res) {
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
    // 批量通过版本升级（需先勾选行；§4.2 审批通过 diff_type=1 版本变更）
    handleBatchApprove () {
      const that = this
      this.$confirm({
        title: 'Batch Approve Version Upgrade',
        content: `Are you sure to batch approve version upgrade for ${this.selectedRowKeys.length} selected hosts?`,
        onOk () {
          activateHost({ host_ids: that.selectedRowKeys, diff_type: 1 }).then(() => {
            that.$message.success(`Version upgrade approved for ${that.selectedRowKeys.length} hosts`)
            that.$refs.table.clearSelected()
            that.$refs.table.refresh()
          }).catch(e => {
            that.$message.error(getErrMsg(e, 'Failed to batch approve version upgrade'))
          })
        }
      })
    },
    // 维护通知邮箱：打开弹窗时实时查询当前生效邮箱（§4.2 维护邮箱-查），并清空上次输入
    handleMaintainEmail () {
      this.emailVisible = true
      this.emailLoading = true
      this.currentEmail = ''
      this.$nextTick(() => {
        this.emailForm.resetFields()
      })
      fetchMaintainEmail().then(res => {
        this.currentEmail = (res.data && res.data.conf_val) || ''
      }).catch(e => {
        this.$message.error(getErrMsg(e, 'Failed to load current notification email'))
      }).finally(() => {
        this.emailLoading = false
      })
    },
    // 确认邮箱与新邮箱一致
    handleConfirmEmail (rule, value, callback) {
      const newEmail = this.emailForm.getFieldValue('email')
      if (value && newEmail && value !== newEmail) {
        callback(new Error('The two emails do not match'))
      } else {
        callback()
      }
    },
    handleEmailOk () {
      this.emailForm.validateFields((err, values) => {
        if (err) return
        // 请求期间 confirm-loading 锁住 OK 按钮，防止重复提交
        this.emailSubmitting = true
        // 保存通知邮箱（§4.2 维护邮箱-改：{email, email_confirm?}，不一致 422 EMAIL_CONFIRM_MISMATCH）
        maintainEmail({ email: values.email, email_confirm: values.confirmEmail }).then(() => {
          this.$message.success(`Notification email saved: ${values.email}`)
          this.currentEmail = values.email
          this.emailVisible = false
        }).catch(e => {
          this.$message.error(getErrMsg(e, 'Failed to save notification email'))
        }).finally(() => {
          this.emailSubmitting = false
        })
      })
    },
    // 单行审批通过（§4.2 审批通过：diff_type 取行变更类型 diff_state，1=版本变更 2=内容变更）
    handleApproveEnable (record) {
      const that = this
      this.$confirm({
        title: 'Approve Enable',
        content: `Are you sure to approve and enable Host ${record.host_no || record.host_id} (${record.host_ip})?`,
        onOk () {
          activateHost({ host_ids: [record.host_id], diff_type: record.diff_state }).then(() => {
            that.$message.success(`Host ${record.host_no || record.host_id} has been approved and enabled`)
            that.$refs.table.refresh()
          }).catch(e => {
            that.$message.error(getErrMsg(e, `Failed to approve Host ${record.host_no || record.host_id}`))
          })
        }
      })
    },
    // 跳转到 Pending HOST 详情页（/pending-host/detail），携带 Host 信息供详情页展示
    handleView (record) {
      this.$router.push({
        path: '/pending-host/detail',
        query: {
          id: record.host_id
        }
      })
    },
    // 删除 Host（§3.2：DELETE /host/{host_id}，逻辑删除；与可用主机列表共用 deleteEnabledHost）
    handleDelete (record) {
      const that = this
      this.$confirm({
        title: 'Delete Host',
        content: `Are you sure to delete Host ${record.host_no || record.host_id} (${record.host_ip})? This cannot be undone!`,
        okType: 'danger',
        onOk () {
          deleteEnabledHost(record.host_id).then(() => {
            that.$message.success(`Host ${record.host_no || record.host_id} has been deleted`)
            that.$refs.table.refresh()
          }).catch(e => {
            that.$message.error(getErrMsg(e, `Failed to delete Host ${record.host_no || record.host_id}`))
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

// 操作按钮区域：与表格之间留出间距
.table-operator {
  margin-bottom: 16px;
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
  // 保证 Approve Enable~Delete 始终单行显示
  flex-wrap: nowrap;
  white-space: nowrap;
  align-items: center;

  // 收紧分隔线间距，与单元格 padding 协调，保持列间距视觉一致
  /deep/ .ant-divider-vertical {
    margin: 0 4px;
  }
}

.danger-link {
  color: #f5222d;

  &:hover {
    color: #ff7875;
  }
}

// 维护通知邮箱弹窗：输入框行距加大（默认 24px 视觉偏挤），
// 末项去掉 margin，避免弹窗底部留白过大
.email-form {
  /deep/ .ant-form-item {
    margin-bottom: 32px;

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
