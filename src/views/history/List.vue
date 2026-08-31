<template>
  <page-header-wrapper>
    <a-card :bordered="false">
      <s-table
        ref="table"
        size="default"
        rowKey="key"
        :columns="columns"
        :data="loadData"
        showPagination="auto"
      >
        <span slot="status" slot-scope="text">
          <a-badge :status="text | statusTypeFilter" :text="text | statusFilter" />
        </span>

        <span slot="action" slot-scope="text, record">
          <template>
            <a @click="handleEdit(record)">查看</a>
          </template>
        </span>
      </s-table>

      <a-modal
        width="80vw"
        :visible="visible"
        @ok="visible = false"
        @cancel="visible = false"
      >
        <div style="width: 100%; height: 75vh; overflow-y: auto;margin-top: 20px;" v-show="modalConShow">

          <a-collapse v-model="activeKey">
            <a-collapse-panel key="1">
              <template slot="header">
                <div class="diff-panel-header">
                  <span class="diff-panel-title">Board</span>
                  <span class="diff-panel-stat">
                    <a-badge v-if="diffStats.board.isChanged" :count="'+' + diffStats.board.addNum" :number-style="{ backgroundColor: '#52c41a', marginLeft: '8px' }" />
                    <a-badge v-if="diffStats.board.isChanged" :count="'-' + diffStats.board.delNum" :number-style="{ backgroundColor: '#f5222d', marginLeft: '8px' }" />
                    <a-tag v-if="!diffStats.board.isChanged" color="default">无变更</a-tag>
                  </span>
                </div>
              </template>
              <CodeDiff
                :old-string="jTos(oldData['board'])"
                :new-string="jTos(newData['board'])"
                output-format="side-by-side"
                :context="10"
                :highlight="true"
                language="json"
                maxHeight="68vh"
                :hide-header="true"
                :hide-stat="true"
                @diff="(r) => onDiff('board', r)"
              />
            </a-collapse-panel>
            <a-collapse-panel key="2">
              <template slot="header">
                <div class="diff-panel-header">
                  <span class="diff-panel-title">Memory</span>
                  <span class="diff-panel-stat">
                    <a-badge v-if="diffStats.memory.isChanged" :count="'+' + diffStats.memory.addNum" :number-style="{ backgroundColor: '#52c41a', marginLeft: '8px' }" />
                    <a-badge v-if="diffStats.memory.isChanged" :count="'-' + diffStats.memory.delNum" :number-style="{ backgroundColor: '#f5222d', marginLeft: '8px' }" />
                    <a-tag v-if="!diffStats.memory.isChanged" color="default">无变更</a-tag>
                  </span>
                </div>
              </template>
              <CodeDiff
                :old-string="jTos(oldData['memory'])"
                :new-string="jTos(newData['memory'])"
                output-format="side-by-side"
                :context="10"
                :highlight="true"
                language="json"
                maxHeight="68vh"
                :hide-header="true"
                :hide-stat="true"
                @diff="(r) => onDiff('memory', r)"
              />
            </a-collapse-panel>
            <a-collapse-panel key="3">
              <template slot="header">
                <div class="diff-panel-header">
                  <span class="diff-panel-title">HSIO</span>
                  <span class="diff-panel-stat">
                    <a-badge v-if="diffStats.hsio.isChanged" :count="'+' + diffStats.hsio.addNum" :number-style="{ backgroundColor: '#52c41a', marginLeft: '8px' }" />
                    <a-badge v-if="diffStats.hsio.isChanged" :count="'-' + diffStats.hsio.delNum" :number-style="{ backgroundColor: '#f5222d', marginLeft: '8px' }" />
                    <a-tag v-if="!diffStats.hsio.isChanged" color="default">无变更</a-tag>
                  </span>
                </div>
              </template>
              <CodeDiff
                :old-string="jTos(oldData['hsio'])"
                :new-string="jTos(newData['hsio'])"
                output-format="side-by-side"
                :context="10"
                :highlight="true"
                language="json"
                maxHeight="68vh"
                :hide-header="true"
                :hide-stat="true"
                @diff="(r) => onDiff('hsio', r)"
              />
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

const statusMap = {
  1: {
    status: 'processing',
    text: '待审核'
  },
  2: {
    status: 'success',
    text: '审核通过'
  },
  3: {
    status: 'error',
    text: '驳回'
  }
}

const json1 = {
  analyze: {
    murmur: { abnormal: false, probability: 0.1531, type: null },
    heart_rate_bpm: 42,
    signal_quality: {
      score: 0.024,
      label: 'poor',
      periodicity: 0.017,
      pulsatility: 2.596,
      low_band_fraction: 0.818,
      hf_fraction: 0.121
    },
    rhythm: { classification: 'unknown', heart_rate_bpm: null, pattern: [], confidence: 'low', recommend_ecg: false }
  },
  noise: {
    filename: 'pet_file-1787565735361-e54ba3e6-289f-4fd4-b3ca-1efcfb7a2c43.wav',
    method: 'unet',
    species: 'dog',
    sample_rate: 11025,
    orig_s: 7.42,
    out_s: 7.42,
    trim: { n_windows: 28, n_cardiac: 1, trimmed: false, head_trim_s: 0, tail_trim_s: 0 },
    quality: {
      duration_s: 7.42,
      species: 'dog',
      summary: {
        mean_noise_level: 5.7,
        heart_rate_bpm: 81,
        heart_rate_confidence: 0,
        clear_s: 0,
        marginal_s: 4.92,
        noisy_s: 2.5,
        usable_fraction: 0.663
      },
      noise_levels: [
        [0, 7.6],
        [0.5, 4.8],
        [1, 4.7],
        [1.5, 5],
        [2, 7.3],
        [2.5, 6.5],
        [3, 4.2],
        [3.5, 5.5],
        [4, 5],
        [4.5, 6.1],
        [5, 6],
        [5.5, 6.3],
        [6, 5.3]
      ]
    }
  }
}
const json2 = {
  analyze:
    {
      normal_abnormal: 'abnormal',
      murmur_probability: 0.6403,
      murmur_type: {
      timing: {
          label: 'Holosystolic',
          confidence: 0.5776
      },
        grade: {
        label: 'III/VI',
          confidence: 0.7043
      }
    }
    },
  noise:
    {
      filename: 'pet_file-1787019514216-58503688-0350-4efd-9cba-8a83a5aa7fdb.wav',
      method: 'unet',
      species: 'cat',
      sample_rate: 11025,
      orig_s: 18.16,
      out_s: 18.16,
      trim: {
        n_windows: 71,
        n_cardiac: 67,
        trimmed: false,
        head_trim_s: 0,
        tail_trim_s: 0
      },
      quality: {
        duration_s: 18.16,
        species: 'cat',
        summary: {
          mean_noise_level: 4.1,
          heart_rate_bpm: 150,
          heart_rate_confidence: 0.12,
          clear_s: 4,
          marginal_s: 12.16,
          noisy_s: 2,
          usable_fraction: 0.89
        },
        noise_levels: [[0, 7], [0.5, 3.8], [1, 6.9], [1.5, 5.2], [2, 4], [2.5, 4.4], [3, 3.7], [3.5, 4.2], [4, 4.6], [4.5, 4.2], [5, 3], [5.5, 3.8], [6, 5], [6.5, 4.6], [7, 5.7], [7.5, 3.7], [8, 1.5], [8.5, 4], [9, 1.9], [9.5, 5.7], [10, 2.6], [10.5, 3.7], [11, 3.1], [11.5, 2.7], [12, 2.5], [12.5, 6.4], [13, 1.8], [13.5, 3.8], [14, 1.5], [14.5, 4.7], [15, 6.3], [15.5, 4.2], [16, 4.1], [16.5, 4.9], [17, 3.6]]
      }
    }
}

export default {
  name: 'TableList',
  components: {
    STable,
    Ellipsis,
    CodeDiff
  },
  data () {
    return {
      oldJsonString: JSON.stringify(json2, null, 2),
      newJsonString: JSON.stringify(json1, null, 2),
      activeKey: ['1'],
      diffStats: {
        board: { isChanged: false, addNum: 0, delNum: 0 },
        memory: { isChanged: false, addNum: 0, delNum: 0 },
        hsio: { isChanged: false, addNum: 0, delNum: 0 }
      },
      oldData: {
        board: json2,
        memory: json2,
        hsio: json2
      },
      newData: {
        board: json1,
        memory: json1,
        hsio: json1
      },
      visible: false,
      modalConShow: false,
      // create model
      columns: [
        {
          title: '修改人',
          dataIndex: 'ename'
        },
        { title: '修改时间', dataIndex: 'etime' },
        { title: '审核人', dataIndex: 'aname' },
        { title: '审核时间', dataIndex: 'atime' },
        { title: '审核状态',
          dataIndex: 'status',
          scopedSlots: { customRender: 'status' } },
        { title: '操作',
          dataIndex: 'action',
          width: 200,
          scopedSlots: { customRender: 'action' } }
      ],
      // 加载数据方法 必须为 Promise 对象
      loadData: () => {
        return new Promise((resolve, reject) => {
          resolve({
            pageSize: 10,
            pageNo: 1,
            totalCount: 10,
            totalPage: 1,
            data: [
              {
                ename: '张三',
                etime: '2025-08-24 10:11:00',
                aname: '李四',
                atime: '2025-08-24 11:11:00',
                status: 1
              },
              {
                ename: '张三',
                etime: '2025-08-24 10:11:00',
                aname: '李四',
                atime: '2025-08-24 11:11:00',
                status: 2
              },
              {
                ename: '张三',
                etime: '2025-08-24 10:11:00',
                aname: '李四',
                atime: '2025-08-24 11:11:00',
                status: 1
              },
              {
                ename: '张三',
                etime: '2025-08-24 10:11:00',
                aname: '李四',
                atime: '2025-08-24 11:11:00',
                status: 3
              },
              {
                ename: '张三',
                etime: '2025-08-24 10:11:00',
                aname: '李四',
                atime: '2025-08-24 11:11:00',
                status: 1
              }
            ]
          })
        })
      }
    }
  },
  filters: {
    statusFilter (type) {
      console.log('aaaaaaaaaaaaaaaaaaa', type)
      return statusMap[type].text
    },
    statusTypeFilter (type) {
      return statusMap[type].status
    }
  },
  methods: {
    handleEdit (record) {
      this.visible = true
      this.activeKey = ['1', '2', '3']
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
    jTos (jObj) {
      return JSON.stringify(jObj || {}, null, 2)
    },
    onDiff (key, diffResult) {
      const { isChanged, addNum, delNum } = diffResult.stat
      this.$set(this.diffStats, key, { isChanged, addNum, delNum })
    }
  }
}
</script>

<style lang="less" scoped>
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
/deep/ .ant-collapse{
  .ant-collapse-content{
    .ant-collapse-content-box{
      padding: 0;
      .code-diff-view{
        margin-top: 0;
        margin-bottom: 0;
        border: none;
      }
    }
  }
}
</style>
